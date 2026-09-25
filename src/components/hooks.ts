import { useEffect, useState } from 'preact/hooks';
import { browser } from 'wxt/browser';
import { hasNotificationPermission, isPinned } from '@/lib/notifications';
import type { Rule } from '@/lib/rules';
import { getNotify, getPaused, getRules, onSettingsChanged } from '@/lib/store';

export function useSettings() {
  const [rules, setRules] = useState<Rule[]>();
  const [paused, setPaused] = useState(false);
  const [notify, setNotify] = useState(false);
  useEffect(() => {
    void getRules().then(setRules);
    void getPaused().then(setPaused);
    void getNotify().then(setNotify);
    return onSettingsChanged((change) => {
      if (change.rules) setRules(change.rules);
      if (change.paused !== undefined) setPaused(change.paused);
      if (change.notify !== undefined) setNotify(change.notify);
    });
  }, []);
  return { rules, paused, notify };
}

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Re-reads `read` on mount, when the window regains focus, and on any extra `events`. */
function useLive<T>(read: () => Promise<T>, initial: T, events: { addListener(fn: () => void): void; removeListener(fn: () => void): void }[]) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    const refresh = () => void read().then(setValue);
    refresh();
    window.addEventListener('focus', refresh);
    for (const e of events) e.addListener(refresh);
    return () => {
      window.removeEventListener('focus', refresh);
      for (const e of events) e.removeListener(refresh);
    };
  }, []);
  return value;
}

export const useNotificationPermission = () =>
  useLive(hasNotificationPermission, false, [browser.permissions.onAdded, browser.permissions.onRemoved]);

export const usePinned = () =>
  useLive(isPinned, true, browser.action.onUserSettingsChanged ? [browser.action.onUserSettingsChanged] : []);
