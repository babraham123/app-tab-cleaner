import { browser, type Browser } from 'wxt/browser';

/** Optional so the install prompt stays at tabs/storage/alarms; requested when the user opts in. */
const PERMISSION: Browser.permissions.Permissions = { permissions: ['notifications'] };

export const hasNotificationPermission = () => browser.permissions.contains(PERMISSION);

/** Must be called directly from a user gesture (e.g. a click handler), before any await. */
export const requestNotificationPermission = () => browser.permissions.request(PERMISSION);

export const removeNotificationPermission = () => browser.permissions.remove(PERMISSION);

/** `isOnToolbar` is unknown on browsers without action.getUserSettings; treat that as pinned. */
export async function isPinned(): Promise<boolean> {
  const getUserSettings = browser.action.getUserSettings as (() => Promise<{ isOnToolbar?: boolean }>) | undefined;
  if (!getUserSettings) return true;
  try {
    return (await getUserSettings()).isOnToolbar !== false;
  } catch {
    return true;
  }
}
