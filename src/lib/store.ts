import { browser } from 'wxt/browser';
import { applyPresetUpdates, seedRules } from './presets';
import type { Rule } from './rules';

const RULES_KEY = 'rules';
const PAUSED_KEY = 'paused';

export async function getRules(): Promise<Rule[]> {
  const stored = await browser.storage.sync.get(RULES_KEY);
  return (stored[RULES_KEY] as Rule[] | undefined) ?? [];
}

export async function setRules(rules: Rule[]): Promise<void> {
  await browser.storage.sync.set({ [RULES_KEY]: rules });
}

export async function getPaused(): Promise<boolean> {
  const stored = await browser.storage.sync.get(PAUSED_KEY);
  return stored[PAUSED_KEY] === true;
}

export async function setPaused(paused: boolean): Promise<void> {
  await browser.storage.sync.set({ [PAUSED_KEY]: paused });
}

export interface SettingsChange {
  rules?: Rule[];
  paused?: boolean;
}

export function onSettingsChanged(listener: (change: SettingsChange) => void): () => void {
  const handler = (changes: Record<string, { newValue?: unknown }>, area: string) => {
    if (area !== 'sync') return;
    const change: SettingsChange = {};
    if (RULES_KEY in changes) change.rules = (changes[RULES_KEY]!.newValue as Rule[] | undefined) ?? [];
    if (PAUSED_KEY in changes) change.paused = changes[PAUSED_KEY]!.newValue === true;
    if (change.rules || change.paused !== undefined) listener(change);
  };
  browser.storage.onChanged.addListener(handler);
  return () => browser.storage.onChanged.removeListener(handler);
}

/** Seeds presets on first install; on update, refreshes presets the user hasn't edited. */
export async function initRules(reason: string): Promise<void> {
  const stored = await browser.storage.sync.get(RULES_KEY);
  const rules = stored[RULES_KEY] as Rule[] | undefined;
  if (rules === undefined) {
    await setRules(seedRules());
  } else if (reason === 'update') {
    const result = applyPresetUpdates(rules);
    if (result.changed) await setRules(result.rules);
  }
}
