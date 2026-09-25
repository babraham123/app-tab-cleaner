import { describe, expect, it, vi } from 'vitest';
import { fakeBrowser } from 'wxt/testing/fake-browser';
import { getRules } from '@/lib/store';
import { PRESETS } from '@/lib/presets';
import { useHarness } from './harness';

const h = useHarness();
const ZOOM = 'https://acme.zoom.us/j/123?pwd=abc';

async function withRule(rule: Parameters<typeof h.setRules>[0][number] = {}) {
  await h.setRules([{ include: ['^https://example\\.com/launch'], ...rule }]);
  await h.start();
}

describe('closing matching tabs', () => {
  it('closes a matching tab after the default 10s, not before', async () => {
    await withRule();
    const id = await h.openTab('https://example.com/launch/1');
    await h.advance(9_900);
    expect(h.isOpen(id)).toBe(true);
    await h.advance(200);
    expect(h.isOpen(id)).toBe(false);
  });

  it('leaves non-matching tabs alone', async () => {
    await withRule();
    const id = await h.openTab('https://example.com/other');
    await h.advance(60_000);
    expect(h.isOpen(id)).toBe(true);
  });

  it('starts the countdown when an existing tab navigates into a match', async () => {
    await withRule();
    const id = await h.openTab('https://example.com/');
    await h.navigate(id, 'https://example.com/launch/1');
    await h.advance(10_000);
    expect(h.isOpen(id)).toBe(false);
  });

  it('starts the countdown when a matching tab opened before the rule existed is reloaded', async () => {
    await h.start();
    const id = await h.openTab('https://example.com/launch');
    await h.setRules([{ include: ['^https://example\\.com/launch'] }]);
    await h.advance(20_000);
    expect(h.isOpen(id)).toBe(true);
    await h.reload(id);
    await h.advance(10_000);
    expect(h.isOpen(id)).toBe(false);
  });

  it('matches case-insensitively', async () => {
    await withRule();
    const id = await h.openTab('HTTPS://EXAMPLE.COM/LAUNCH');
    await h.advance(10_000);
    expect(h.isOpen(id)).toBe(false);
  });

  it('closes immediately with a 0s timeout', async () => {
    await withRule({ timeoutSec: 0 });
    const id = await h.openTab('https://example.com/launch');
    await h.advance(1);
    expect(h.isOpen(id)).toBe(false);
  });

  it('honours exclude patterns', async () => {
    await withRule({ exclude: ['keep=1'] });
    const id = await h.openTab('https://example.com/launch?keep=1');
    await h.advance(20_000);
    expect(h.isOpen(id)).toBe(true);
  });

  it('uses the first matching rule in list order', async () => {
    await h.setRules([
      { include: ['example\\.com/launch/slow'], timeoutSec: 30 },
      { include: ['example\\.com/launch'], timeoutSec: 5 },
    ]);
    await h.start();
    const slow = await h.openTab('https://example.com/launch/slow');
    const fast = await h.openTab('https://example.com/launch/fast');
    await h.advance(5_000);
    expect(h.isOpen(fast)).toBe(false);
    expect(h.isOpen(slow)).toBe(true);
    await h.advance(25_000);
    expect(h.isOpen(slow)).toBe(false);
  });

  it('skips disabled rules', async () => {
    await withRule({ enabled: false });
    const id = await h.openTab('https://example.com/launch');
    await h.advance(20_000);
    expect(h.isOpen(id)).toBe(true);
  });

  it('shows a countdown on the badge and clears it when cancelled', async () => {
    await withRule();
    const id = await h.openTab('https://example.com/launch');
    expect(await h.badge(id)).toBe('10');
    await h.advance(3_000);
    expect(await h.badge(id)).toBe('7');
    await h.navigate(id, 'https://example.com/elsewhere');
    expect(await h.badge(id)).toBe('');
  });
});

describe('cancelling', () => {
  it('cancels when the tab navigates to a non-matching URL', async () => {
    await withRule();
    const id = await h.openTab('https://example.com/launch');
    await h.advance(5_000);
    await h.navigate(id, 'https://example.com/continue-in-browser');
    await h.advance(60_000);
    expect(h.isOpen(id)).toBe(true);
  });

  it('keeps the original deadline when moving between URLs of the same rule', async () => {
    await withRule();
    const id = await h.openTab('https://example.com/launch/1');
    await h.advance(6_000);
    await h.navigate(id, 'https://example.com/launch/2');
    await h.advance(4_000);
    expect(h.isOpen(id)).toBe(false);
  });

  it('never closes pinned tabs, and pinning cancels a countdown', async () => {
    await withRule();
    const pinned = await h.openTab('https://example.com/launch', { pinned: true });
    const later = await h.openTab('https://example.com/launch');
    await h.pin(later);
    await h.advance(20_000);
    expect(h.isOpen(pinned)).toBe(true);
    expect(h.isOpen(later)).toBe(true);
  });

  it('"Keep this tab" exempts the tab for the rest of its life', async () => {
    await withRule();
    const id = await h.openTab('https://example.com/launch/1');
    expect(await h.send({ type: 'keepTab', tabId: id })).toEqual({ kept: true });
    await h.navigate(id, 'https://example.com/other');
    await h.navigate(id, 'https://example.com/launch/2');
    await h.advance(60_000);
    expect(h.isOpen(id)).toBe(true);
  });

  it('reports the countdown for the popup', async () => {
    await withRule({ name: 'Launcher' });
    const id = await h.openTab('https://example.com/launch');
    expect(await h.send({ type: 'getTabState', tabId: id })).toEqual({
      deadline: Date.now() + 10_000,
      ruleName: 'Launcher',
      kept: false,
    });
  });
});

describe('pause', () => {
  it('cancels pending closes and ignores new matches until resumed', async () => {
    await withRule();
    const before = await h.openTab('https://example.com/launch');
    await h.setPaused(true);
    const during = await h.openTab('https://example.com/launch');
    await h.advance(20_000);
    expect(h.isOpen(before)).toBe(true);
    expect(h.isOpen(during)).toBe(true);
    expect(fakeBrowser.action.setIcon).toHaveBeenLastCalledWith({
      path: expect.objectContaining({ 16: '/icon/paused-16.png' }),
    });

    await h.setPaused(false);
    const after = await h.openTab('https://example.com/launch');
    await h.advance(10_000);
    expect(h.isOpen(after)).toBe(false);
  });
});

describe('editing rules while countdowns are pending', () => {
  it('cancels countdowns whose rule is disabled or deleted', async () => {
    await withRule();
    const id = await h.openTab('https://example.com/launch');
    await h.setRules([]);
    await h.advance(20_000);
    expect(h.isOpen(id)).toBe(true);
  });

  it('restarts countdowns with the new timeout', async () => {
    await withRule({ id: 'r1' });
    const id = await h.openTab('https://example.com/launch');
    await h.advance(8_000);
    await h.setRules([{ id: 'r1', include: ['^https://example\\.com/launch'], timeoutSec: 5 }]);
    await h.advance(4_000);
    expect(h.isOpen(id)).toBe(true);
    await h.advance(1_000);
    expect(h.isOpen(id)).toBe(false);
  });
});

describe('last tab in a window', () => {
  it('opens a new tab in that window before closing the matching one', async () => {
    await withRule();
    h.existingTab('https://other.window/', 2);
    const id = await h.openTab('https://example.com/launch', { windowId: 1 });
    await h.advance(10_000);
    expect(h.isOpen(id)).toBe(false);
    expect(h.tabs().filter((t) => t.windowId === 1)).toEqual([
      expect.objectContaining({ url: 'chrome://newtab/' }),
    ]);
  });

  it('does not open an extra tab when others remain', async () => {
    await withRule();
    h.existingTab('https://example.com/', 1);
    await h.openTab('https://example.com/launch', { windowId: 1 });
    await h.advance(10_000);
    expect(h.tabs().map((t) => t.url)).toEqual(['https://example.com/']);
  });
});

describe('tabs that existed before the extension started', () => {
  it('ignores them at browser startup until they navigate elsewhere', async () => {
    await withRule();
    const restored = h.existingTab('https://example.com/launch/1');
    await h.browserStartup();
    // Session restore reloading the same URL is not a new match.
    await h.navigate(restored, 'https://example.com/launch/1');
    await h.reload(restored);
    await h.advance(20_000);
    expect(h.isOpen(restored)).toBe(true);

    await h.navigate(restored, 'https://example.com/launch/2');
    await h.advance(10_000);
    expect(h.isOpen(restored)).toBe(false);
  });

  it('ignores them on install', async () => {
    const existing = h.existingTab(ZOOM + '#success');
    await h.start();
    await h.install();
    await h.navigate(existing, ZOOM + '#success');
    await h.advance(20_000);
    expect(h.isOpen(existing)).toBe(true);
  });
});

describe('service worker suspension', () => {
  it('resumes a pending close after a restart', async () => {
    await withRule({ timeoutSec: 60 });
    const id = await h.openTab('https://example.com/launch');
    await h.advance(20_000);
    h.suspend();
    await h.start();
    await h.advance(39_000);
    expect(h.isOpen(id)).toBe(true);
    await h.advance(1_000);
    expect(h.isOpen(id)).toBe(false);
  });

  it('closes on the backup alarm when the in-memory timer was lost', async () => {
    await withRule({ timeoutSec: 60 });
    const id = await h.openTab('https://example.com/launch');
    expect(await fakeBrowser.alarms.getAll()).toEqual([
      expect.objectContaining({ name: `close:${id}`, scheduledTime: Date.now() + 60_000 }),
    ]);
    h.suspend();
    // Move the clock without running timers, like a suspended worker waking late.
    vi.setSystemTime(Date.now() + 61_000);
    await h.start();
    await h.fireAlarms();
    expect(h.isOpen(id)).toBe(false);
  });

  it('schedules the backup alarm no sooner than 30s', async () => {
    await withRule();
    await h.openTab('https://example.com/launch');
    expect((await fakeBrowser.alarms.getAll())[0]!.scheduledTime).toBe(Date.now() + 30_000);
  });
});

describe('presets', () => {
  it('seeds presets on first install with Figma and Spotify disabled', async () => {
    await h.start();
    await h.install();
    const rules = await getRules();
    expect(rules.map((r) => [r.presetId, r.enabled, r.timeoutSec])).toEqual([
      ['zoom', true, 10],
      ['slack', true, 10],
      ['teams', true, 10],
      ['notion', true, 10],
      ['discord', true, 10],
      ['linear', true, 10],
      ['figma', false, 10],
      ['spotify', false, 10],
    ]);
  });

  it('closes a Zoom tab only after the desktop handoff marks it #success', async () => {
    await h.start();
    await h.install();
    const id = await h.openTab(ZOOM);
    await h.advance(20_000);
    expect(h.isOpen(id)).toBe(true);
    await h.navigate(id, ZOOM + '#success');
    await h.advance(10_000);
    expect(h.isOpen(id)).toBe(false);
  });

  it('does not reseed when rules already exist', async () => {
    await h.setRules([{ name: 'mine', include: ['x'] }]);
    await h.start();
    await h.install();
    expect((await getRules()).map((r) => r.name)).toEqual(['mine']);
  });

  it('updates unmodified presets on extension update and leaves edited ones alone', async () => {
    const zoom = PRESETS.find((p) => p.id === 'zoom')!;
    await h.setRules([
      { name: 'Zoom', presetId: 'zoom', presetVersion: 0, include: ['old'], timeoutSec: 20, enabled: false },
      { name: 'My Zoom', presetId: 'zoom', presetVersion: 0, include: ['mine'], modified: true },
    ]);
    await h.start();
    await h.install('update');
    const [updated, edited] = await getRules();
    expect(updated).toMatchObject({ include: zoom.include, presetVersion: zoom.version, timeoutSec: 20, enabled: false });
    expect(edited).toMatchObject({ include: ['mine'], presetVersion: 0 });
  });
});
