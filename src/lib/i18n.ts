import { browser } from 'wxt/browser';

/** Looks up a `_locales` message, falling back to the key so missing strings are visible. */
export function t(key: string, subs?: string | string[]): string {
  // WXT types getMessage with the literal keys; callers here pass keys from data (presets, errors).
  const getMessage = browser.i18n.getMessage as (key: string, subs?: string | string[]) => string;
  return getMessage(key, subs) || key;
}
