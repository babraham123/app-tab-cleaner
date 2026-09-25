import { t } from '@/lib/i18n';
import type { RuleError } from '@/lib/rules';

export function errorText(error: RuleError | undefined): string | undefined {
  return error && t(error.key, error.subs);
}

export function FieldError({ error }: { error?: RuleError }) {
  return error ? <p class="error">{errorText(error)}</p> : null;
}
