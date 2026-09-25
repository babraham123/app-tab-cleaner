import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { browser, type Browser } from 'wxt/browser';
import { useNow, useSettings } from '@/components/hooks';
import { PinNudge } from '@/components/Notifications';
import { PauseToggle } from '@/components/PauseToggle';
import { t } from '@/lib/i18n';
import { getTabState, keepTab, type TabState } from '@/lib/messages';
import { suggestRule } from '@/lib/rules';
import '@/components/styles.css';
import './popup.css';

function Popup() {
  const { paused } = useSettings();
  const now = useNow();
  const [tab, setTab] = useState<Browser.tabs.Tab>();
  const [state, setState] = useState<TabState>();

  useEffect(() => {
    void browser.tabs.query({ active: true, currentWindow: true }).then(([active]) => setTab(active));
  }, []);

  // Poll so the popup reflects cancellations (navigation, rule edits) as well as the countdown.
  useEffect(() => {
    if (tab?.id !== undefined) void getTabState(tab.id).then(setState);
  }, [tab, now]);

  const canSuggest = tab?.url && suggestRule(tab.url);

  const addRule = async () => {
    await browser.tabs.create({
      url: `${browser.runtime.getURL('/options.html')}#new=${encodeURIComponent(tab!.url!)}`,
    });
    window.close();
  };

  return (
    <main>
      <header>
        <div class="brand">
          <img src="/icon/48.png" alt="" />
          <h1 style={{ fontSize: '15px' }}>{t('extName')}</h1>
        </div>
      </header>

      <PinNudge />

      <PauseToggle paused={paused} />

      <section class="status" aria-live="polite">
        {paused ? (
          <span class="muted">{t('pausedBanner')}</span>
        ) : state?.deadline ? (
          <>
            <span class="countdown">{t('closingIn', String(Math.max(0, Math.ceil((state.deadline - now) / 1000))))}</span>
            {state.ruleName && <span class="muted">{t('closingInRule', state.ruleName)}</span>}
            <button class="primary" onClick={() => void keepTab(tab!.id!).then(setState)}>
              {t('keepTab')}
            </button>
          </>
        ) : state?.kept ? (
          <span>{t('tabKept')}</span>
        ) : (
          <span class="muted">{t('noMatch')}</span>
        )}
      </section>

      <footer>
        <button onClick={() => void addRule()} disabled={!canSuggest}>
          {t('addRuleFromTab')}
        </button>
        <button class="link" onClick={() => void browser.runtime.openOptionsPage().then(() => window.close())}>
          {t('openSettings')}
        </button>
      </footer>
    </main>
  );
}

render(<Popup />, document.getElementById('app')!);
