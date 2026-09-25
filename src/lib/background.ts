import { browser, type Browser } from 'wxt/browser';
import type { Request, TabState } from './messages';
import { findRule, type Rule } from './rules';
import { getPaused, getRules, initRules, onSettingsChanged } from './store';

interface Pending {
  ruleId: string;
  timeoutSec: number;
  deadline: number;
}

/** Kept in storage.session so countdowns survive the service worker being suspended. */
interface SessionState {
  pending: Record<string, Pending>;
  kept: number[];
  /** URLs of tabs that already existed at startup/install; they're ignored until they navigate elsewhere. */
  baseline: Record<string, string>;
}

const SESSION_KEY = 'state';
const ALARM_PREFIX = 'close:';
// Chrome clamps alarms to >= 30s; setTimeout covers shorter timeouts.
const MIN_ALARM_MS = 30_000;
const TICK_MS = 1000;
const BADGE_COLOR = '#7c4dff';

const iconPaths = (prefix: string) =>
  Object.fromEntries([16, 32, 48, 128].map((size) => [size, `/icon/${prefix}${size}.png`]));
const ICONS = iconPaths('');
const PAUSED_ICONS = iconPaths('paused-');

export function formatBadge(msLeft: number): string {
  const sec = Math.max(0, Math.ceil(msLeft / 1000));
  return sec < 100 ? String(sec) : `${Math.ceil(sec / 60)}m`;
}

async function getTab(tabId: number): Promise<Browser.tabs.Tab | undefined> {
  try {
    return await browser.tabs.get(tabId);
  } catch {
    return undefined;
  }
}

/**
 * Registers all listeners synchronously (MV3 requires this at startup) and returns a disposer.
 * Every state change runs through a single queue so events, timers and messages never interleave.
 */
export function startBackground(): () => void {
  let state: SessionState = { pending: {}, kept: [], baseline: {} };
  let rules: Rule[] = [];
  let paused = false;
  const timers = new Map<number, ReturnType<typeof setTimeout>>();
  let ticker: ReturnType<typeof setInterval> | undefined;
  let queue: Promise<unknown> = Promise.resolve();

  const ready = (async () => {
    const [stored, storedRules, storedPaused] = await Promise.all([
      browser.storage.session.get(SESSION_KEY),
      getRules(),
      getPaused(),
    ]);
    state = { ...state, ...(stored[SESSION_KEY] as SessionState | undefined) };
    rules = storedRules;
    paused = storedPaused;
    await updateIcon();
    for (const [id, p] of Object.entries(state.pending)) armTimer(Number(id), p.deadline);
    syncTicker();
  })();

  function run<T>(fn: () => Promise<T>): Promise<T> {
    const result = queue.then(async () => {
      await ready;
      const value = await fn();
      await browser.storage.session.set({ [SESSION_KEY]: state });
      return value;
    });
    queue = result.catch((e) => console.error('[app-tab-cleaner]', e));
    return result;
  }

  async function updateIcon() {
    await browser.action.setIcon({ path: paused ? PAUSED_ICONS : ICONS });
  }

  function armTimer(tabId: number, deadline: number) {
    clearTimeout(timers.get(tabId));
    timers.set(
      tabId,
      setTimeout(() => void run(() => closeIfDue(tabId)), Math.max(0, deadline - Date.now())),
    );
  }

  // Ticking the badge every second also keeps the service worker awake during a countdown.
  function syncTicker() {
    const active = Object.keys(state.pending).length > 0;
    if (active && !ticker) ticker = setInterval(() => void renderBadges(), TICK_MS);
    if (!active && ticker) {
      clearInterval(ticker);
      ticker = undefined;
    }
  }

  async function renderBadges() {
    await Promise.all(
      Object.entries(state.pending).map(([id, p]) =>
        browser.action
          .setBadgeText({ tabId: Number(id), text: formatBadge(p.deadline - Date.now()) })
          .catch(() => {}),
      ),
    );
  }

  async function schedule(tabId: number, rule: Rule) {
    const deadline = Date.now() + rule.timeoutSec * 1000;
    state.pending[tabId] = { ruleId: rule.id, timeoutSec: rule.timeoutSec, deadline };
    armTimer(tabId, deadline);
    await browser.alarms.create(`${ALARM_PREFIX}${tabId}`, {
      when: Math.max(deadline, Date.now() + MIN_ALARM_MS),
    });
    syncTicker();
    await browser.action.setBadgeBackgroundColor({ tabId, color: BADGE_COLOR }).catch(() => {});
    await browser.action.setBadgeText({ tabId, text: formatBadge(deadline - Date.now()) }).catch(() => {});
  }

  async function cancel(tabId: number) {
    if (!state.pending[tabId]) return;
    delete state.pending[tabId];
    clearTimeout(timers.get(tabId));
    timers.delete(tabId);
    await browser.alarms.clear(`${ALARM_PREFIX}${tabId}`);
    syncTicker();
    await browser.action.setBadgeText({ tabId, text: '' }).catch(() => {});
  }

  async function evaluate(tabId: number, url: string | undefined, pinned: boolean | undefined) {
    if (!url) return;
    const baseline = state.baseline[tabId];
    if (baseline !== undefined) {
      if (baseline === url) return;
      delete state.baseline[tabId];
    }
    if (paused || state.kept.includes(tabId)) return;
    const rule = pinned ? undefined : findRule(rules, url);
    if (!rule) return cancel(tabId);
    // Moving between URLs of the same rule keeps the original deadline.
    if (state.pending[tabId]?.ruleId === rule.id) return;
    await schedule(tabId, rule);
  }

  async function closeIfDue(tabId: number) {
    const pending = state.pending[tabId];
    if (!pending) return;
    if (Date.now() < pending.deadline) return armTimer(tabId, pending.deadline);
    const tab = await getTab(tabId);
    const stillMatches = tab && !tab.pinned && !paused && findRule(rules, tab.url ?? '');
    await cancel(tabId);
    if (!tab || !stillMatches) return;
    // Closing a window's last tab closes the window (and can quit the browser), so leave a new tab behind.
    const siblings = await browser.tabs.query({ windowId: tab.windowId });
    if (siblings.length <= 1) await browser.tabs.create({ windowId: tab.windowId, active: true });
    await browser.tabs.remove(tabId);
  }

  async function forget(tabId: number) {
    await cancel(tabId);
    state.kept = state.kept.filter((id) => id !== tabId);
    delete state.baseline[tabId];
  }

  async function recheckPending() {
    for (const [id, p] of Object.entries(state.pending)) {
      const tabId = Number(id);
      const tab = await getTab(tabId);
      const rule = tab && findRule(rules, tab.url ?? '');
      if (!rule) await cancel(tabId);
      else if (rule.id !== p.ruleId || rule.timeoutSec !== p.timeoutSec) await schedule(tabId, rule);
    }
  }

  async function snapshotBaseline() {
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
      if (tab.id !== undefined && tab.url && !state.pending[tab.id]) state.baseline[tab.id] = tab.url;
    }
  }

  function tabState(tabId: number): TabState {
    const pending = state.pending[tabId];
    return {
      deadline: pending?.deadline,
      ruleName: pending && rules.find((r) => r.id === pending.ruleId)?.name,
      kept: state.kept.includes(tabId),
    };
  }

  const onCreated = (tab: Browser.tabs.Tab) => {
    if (tab.id !== undefined) void run(() => evaluate(tab.id!, tab.pendingUrl || tab.url, tab.pinned));
  };

  const onUpdated = (tabId: number, change: Browser.tabs.OnUpdatedInfo, tab: Browser.tabs.Tab) => {
    if (change.url) void run(() => evaluate(tabId, change.url, tab.pinned));
    // A reload doesn't change the URL, but should still start a countdown (e.g. a tab that was
    // already open when its rule was added).
    else if (change.status === 'loading') void run(() => evaluate(tabId, tab.url, tab.pinned));
    else if (change.pinned) void run(() => cancel(tabId));
  };

  const onRemoved = (tabId: number) => void run(() => forget(tabId));

  const onReplaced = (addedTabId: number, removedTabId: number) =>
    void run(async () => {
      await forget(removedTabId);
      const tab = await getTab(addedTabId);
      if (tab) await evaluate(addedTabId, tab.url, tab.pinned);
    });

  const onAlarm = (alarm: Browser.alarms.Alarm) => {
    if (alarm.name.startsWith(ALARM_PREFIX)) {
      void run(() => closeIfDue(Number(alarm.name.slice(ALARM_PREFIX.length))));
    }
  };

  const onStartup = () => void run(snapshotBaseline);

  const onInstalled = (details: Browser.runtime.InstalledDetails) =>
    void run(async () => {
      await snapshotBaseline();
      await initRules(details.reason);
    });

  const onMessage = (message: Request, _sender: unknown, sendResponse: (state: TabState) => void) => {
    if (message?.type === 'getTabState') {
      void run(async () => sendResponse(tabState(message.tabId)));
      return true;
    }
    if (message?.type === 'keepTab') {
      void run(async () => {
        if (!state.kept.includes(message.tabId)) state.kept.push(message.tabId);
        await cancel(message.tabId);
        sendResponse(tabState(message.tabId));
      });
      return true;
    }
    return false;
  };

  const stopSettings = onSettingsChanged((change) =>
    void run(async () => {
      if (change.paused !== undefined && change.paused !== paused) {
        paused = change.paused;
        await updateIcon();
        if (paused) for (const id of Object.keys(state.pending)) await cancel(Number(id));
      }
      if (change.rules) {
        rules = change.rules;
        await recheckPending();
      }
    }),
  );

  browser.tabs.onCreated.addListener(onCreated);
  browser.tabs.onUpdated.addListener(onUpdated);
  browser.tabs.onRemoved.addListener(onRemoved);
  browser.tabs.onReplaced?.addListener(onReplaced);
  browser.alarms.onAlarm.addListener(onAlarm);
  browser.runtime.onStartup.addListener(onStartup);
  browser.runtime.onInstalled.addListener(onInstalled);
  browser.runtime.onMessage.addListener(onMessage);

  return () => {
    stopSettings();
    browser.tabs.onCreated.removeListener(onCreated);
    browser.tabs.onUpdated.removeListener(onUpdated);
    browser.tabs.onRemoved.removeListener(onRemoved);
    browser.tabs.onReplaced?.removeListener(onReplaced);
    browser.alarms.onAlarm.removeListener(onAlarm);
    browser.runtime.onStartup.removeListener(onStartup);
    browser.runtime.onInstalled.removeListener(onInstalled);
    browser.runtime.onMessage.removeListener(onMessage);
    for (const timer of timers.values()) clearTimeout(timer);
    clearInterval(ticker);
  };
}
