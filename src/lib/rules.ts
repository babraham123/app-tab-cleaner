export interface Rule {
  id: string;
  name: string;
  /** Regexes (one per entry); the rule matches when any include matches and no exclude does. */
  include: string[];
  exclude: string[];
  timeoutSec: number;
  enabled: boolean;
  /** Set on rules created from a built-in preset. */
  presetId?: string;
  presetVersion?: number;
  /** Set once the user edits a preset rule, which stops automatic preset updates for it. */
  modified?: boolean;
}

export const DEFAULT_TIMEOUT_SEC = 10;
export const MAX_TIMEOUT_SEC = 3600;
/** Longer timeouts fall back to the alarms API, which can fire a few seconds late. */
export const RELIABLE_TIMEOUT_SEC = 25;

const compiled = new Map<string, RegExp | null>();

export function compile(pattern: string): RegExp | null {
  let re = compiled.get(pattern);
  if (re === undefined) {
    try {
      re = new RegExp(pattern, 'i');
    } catch {
      re = null;
    }
    compiled.set(pattern, re);
  }
  return re;
}

export function patternError(pattern: string): string | undefined {
  try {
    new RegExp(pattern, 'i');
    return undefined;
  } catch (e) {
    return (e as Error).message;
  }
}

export interface RuleTest {
  matched: boolean;
  includedBy?: string;
  excludedBy?: string;
}

export function testRule(rule: Pick<Rule, 'include' | 'exclude'>, url: string): RuleTest {
  const includedBy = rule.include.find((p) => compile(p)?.test(url));
  if (!includedBy) return { matched: false };
  const excludedBy = rule.exclude.find((p) => compile(p)?.test(url));
  return { matched: !excludedBy, includedBy, excludedBy };
}

/** First enabled rule in list order wins. */
export function findRule(rules: Rule[], url: string): Rule | undefined {
  return rules.find((r) => r.enabled && testRule(r, url).matched);
}

/** Message keys (with substitutions) from `_locales`, so the UI can translate them. */
export interface RuleError {
  key: string;
  subs?: string[];
}

export type RuleErrors = Partial<Record<'name' | 'include' | 'exclude' | 'timeoutSec', RuleError>>;

function patternListError(patterns: string[]): RuleError | undefined {
  for (const p of patterns) {
    const err = patternError(p);
    if (err) return { key: 'errInvalidPattern', subs: [p, err] };
  }
}

export function validateRule(rule: Rule): RuleErrors {
  const errors: RuleErrors = {};
  if (!rule.name.trim()) errors.name = { key: 'errNameRequired' };
  errors.include = rule.include.length === 0 ? { key: 'errIncludeRequired' } : patternListError(rule.include);
  errors.exclude = patternListError(rule.exclude);
  if (!Number.isInteger(rule.timeoutSec) || rule.timeoutSec < 0 || rule.timeoutSec > MAX_TIMEOUT_SEC) {
    errors.timeoutSec = { key: 'errTimeout', subs: [String(MAX_TIMEOUT_SEC)] };
  }
  return errors;
}

export function isValid(errors: RuleErrors): boolean {
  return Object.values(errors).every((e) => !e);
}

export function newRule(fields: Partial<Rule> = {}): Rule {
  return {
    id: crypto.randomUUID(),
    name: '',
    include: [],
    exclude: [],
    timeoutSec: DEFAULT_TIMEOUT_SEC,
    enabled: true,
    ...fields,
  };
}

export function splitLines(text: string): string[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Prefill for "Add rule from this tab": origin plus the first path segment, e.g. `^https://acme\.zoom\.us/j/`. */
export function suggestRule(url: string): Pick<Rule, 'name' | 'include'> | undefined {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return undefined;
  const segment = parsed.pathname.split('/').find(Boolean);
  const prefix = `${parsed.protocol}//${parsed.host}/${segment ? `${segment}/` : ''}`;
  return { name: parsed.hostname, include: [`^${escapeRegex(prefix)}`] };
}
