import { afterEach, beforeEach, vi } from 'vitest';
import type { Browser } from 'wxt/browser';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { startBackground } from '@/lib/background';
import { newRule, type Rule } from '@/lib/rules';
import { setPaused, setRules } from '@/lib/store';

type Tab = { id: number; windowId: number; url: string; pinned: boolean; index: number };

/**
 * Wraps WXT's fakeBrowser with a small tab model: its built-in tabs.remove mixes up tab and
 * window ids, and action.setIcon and tabs.onReplaced aren't mocked.
 */
export function useHarness() {
  let tabs: Tab[] = [];
  let nextId = 1;
  let stop: (() => void) | undefined;
  const view = (t: Tab) => ({ ...t, active: false, highlighted: false, incognito: false }) as unknown as Browser.tabs.Tab;

  beforeEach(() => {
    fakeBrowser.reset();
    vi.useFakeTimers();
    tabs = [];
    nextId = 1;
    Object.assign(fakeBrowser.tabs, {
      get: async (id: number) => {
        const tab = tabs.find((t) => t.id === id);
        if (!tab) throw new Error(`No tab with id: ${id}`);
        return view(tab);
      },
      query: async (q: { windowId?: number }) =>
        tabs.filter((t) => q.windowId === undefined || t.windowId === q.windowId).map(view),
      create: async ({ url = 'chrome://newtab/', windowId = 1, pinned = false }) => {
        const tab = { id: nextId++, windowId, url, pinned, index: tabs.length };
        tabs.push(tab);
        await fakeBrowser.tabs.onCreated.trigger(view(tab));
        return view(tab);
      },
      update: async (id: number, props: Partial<Tab>) => {
        const tab = tabs.find((t) => t.id === id)!;
        Object.assign(tab, props);
        await fakeBrowser.tabs.onUpdated.trigger(id, props, view(tab));
        return view(tab);
      },
      remove: async (id: number) => {
        const tab = tabs.find((t) => t.id === id)!;
        tabs = tabs.filter((t) => t !== tab);
        await fakeBrowser.tabs.onRemoved.trigger(id, { windowId: tab.windowId, isWindowClosing: false });
      },
    });
    fakeBrowser.action.setIcon = vi.fn(async () => {});
    Object.assign(fakeBrowser.tabs, { onReplaced: { addListener: vi.fn(), removeListener: vi.fn() } });
  });

  afterEach(() => {
    stop?.();
    stop = undefined;
    vi.useRealTimers();
  });

  const settle = () => vi.advanceTimersByTimeAsync(0);

  return {
    /** Starts (or restarts, simulating a service worker suspension) the background. */
    async start() {
      stop?.();
      stop = startBackground();
      await settle();
    },
    /** Kills in-memory timers, like Chrome suspending the service worker. */
    suspend() {
      stop?.();
      stop = undefined;
    },
    async install(reason: Browser.runtime.InstalledDetails['reason'] = 'install') {
      await fakeBrowser.runtime.onInstalled.trigger({ reason });
      await settle();
    },
    async browserStartup() {
      await fakeBrowser.runtime.onStartup.trigger();
      await settle();
    },
    async setRules(rules: Partial<Rule>[]) {
      await setRules(rules.map((r) => newRule({ name: 'rule', ...r })));
      await settle();
    },
    async setPaused(paused: boolean) {
      await setPaused(paused);
      await settle();
    },
    /** Opens a tab without triggering events, as if it existed before the extension started. */
    existingTab(url: string, windowId = 1): number {
      const tab = { id: nextId++, windowId, url, pinned: false, index: tabs.length };
      tabs.push(tab);
      return tab.id;
    },
    async openTab(url: string, opts: { windowId?: number; pinned?: boolean } = {}): Promise<number> {
      const tab = await fakeBrowser.tabs.create({ url, ...opts });
      await settle();
      return tab.id!;
    },
    async navigate(id: number, url: string) {
      await fakeBrowser.tabs.update(id, { url });
      await settle();
    },
    async reload(id: number) {
      const tab = tabs.find((t) => t.id === id)!;
      await fakeBrowser.tabs.onUpdated.trigger(id, { status: 'loading' }, view(tab));
      await settle();
    },
    async pin(id: number) {
      await fakeBrowser.tabs.update(id, { pinned: true });
      await settle();
    },
    async advance(ms: number) {
      await vi.advanceTimersByTimeAsync(ms);
    },
    async fireAlarms() {
      for (const alarm of await fakeBrowser.alarms.getAll()) {
        await fakeBrowser.alarms.onAlarm.trigger(alarm);
      }
      await settle();
    },
    async send(message: unknown) {
      const [response] = await Promise.all([
        new Promise((resolve) => fakeBrowser.runtime.onMessage.trigger(message, {}, resolve)),
        settle(),
      ]);
      return response;
    },
    isOpen: (id: number) => tabs.some((t) => t.id === id),
    tabs: () => tabs.map(view),
    badge: (tabId: number) => fakeBrowser.action.getBadgeText({ tabId }),
  };
}
