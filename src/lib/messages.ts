import { browser } from 'wxt/browser';

export type Request = { type: 'getTabState'; tabId: number } | { type: 'keepTab'; tabId: number };

export interface TabState {
  /** Epoch ms when the tab will close; unset when no countdown is running. */
  deadline?: number;
  ruleName?: string;
  kept: boolean;
}

export function getTabState(tabId: number): Promise<TabState> {
  return browser.runtime.sendMessage({ type: 'getTabState', tabId } satisfies Request);
}

export function keepTab(tabId: number): Promise<TabState> {
  return browser.runtime.sendMessage({ type: 'keepTab', tabId } satisfies Request);
}
