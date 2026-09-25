import { isValid, newRule, validateRule, type Rule, type RuleError } from './rules';

export const EXPORT_VERSION = 1;

export interface ExportFile {
  version: number;
  rules: Rule[];
}

export function exportRules(rules: Rule[]): string {
  return JSON.stringify({ version: EXPORT_VERSION, rules } satisfies ExportFile, null, 2);
}

const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === 'string');

/** `cause` explains which field of an invalid rule failed. */
export type ImportResult = { rules: Rule[] } | { error: RuleError; cause?: RuleError };

export function parseImport(text: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: { key: 'errImportJson' } };
  }
  const file = data as Partial<ExportFile> | null;
  if (file?.version !== EXPORT_VERSION || !Array.isArray(file.rules)) {
    return { error: { key: 'errImportFormat', subs: [String(EXPORT_VERSION)] } };
  }
  const rules: Rule[] = [];
  for (const [i, item] of (file.rules as unknown[]).entries()) {
    const raw = (item ?? {}) as Record<string, unknown>;
    const rule = newRule({
      ...(typeof raw.id === 'string' && { id: raw.id }),
      name: typeof raw.name === 'string' ? raw.name : '',
      include: isStringArray(raw.include) ? raw.include : [],
      exclude: isStringArray(raw.exclude) ? raw.exclude : [],
      timeoutSec: typeof raw.timeoutSec === 'number' ? raw.timeoutSec : NaN,
      enabled: raw.enabled !== false,
      ...(typeof raw.presetId === 'string' && {
        presetId: raw.presetId,
        presetVersion: typeof raw.presetVersion === 'number' ? raw.presetVersion : 0,
        modified: raw.modified === true,
      }),
    });
    const errors = validateRule(rule);
    if (!isValid(errors)) {
      return { error: { key: 'errImportRule', subs: [String(i + 1)] }, cause: Object.values(errors).find(Boolean) };
    }
    rules.push(rule);
  }
  return { rules };
}

/** Merge replaces rules that share an id and appends the rest, preserving existing order. */
export function mergeRules(existing: Rule[], imported: Rule[], replace: boolean): Rule[] {
  if (replace) return imported;
  const byId = new Map(imported.map((r) => [r.id, r]));
  const merged = existing.map((r) => byId.get(r.id) ?? r);
  const existingIds = new Set(existing.map((r) => r.id));
  return [...merged, ...imported.filter((r) => !existingIds.has(r.id))];
}
