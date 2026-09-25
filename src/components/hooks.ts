import { useEffect, useState } from 'preact/hooks';
import type { Rule } from '@/lib/rules';
import { getPaused, getRules, onSettingsChanged } from '@/lib/store';

export function useSettings() {
  const [rules, setRules] = useState<Rule[]>();
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    void getRules().then(setRules);
    void getPaused().then(setPaused);
    return onSettingsChanged((change) => {
      if (change.rules) setRules(change.rules);
      if (change.paused !== undefined) setPaused(change.paused);
    });
  }, []);
  return { rules, paused };
}

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
