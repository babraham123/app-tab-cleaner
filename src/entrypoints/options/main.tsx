import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { useSettings } from '@/components/hooks';
import { NotifyToggle, PinNudge } from '@/components/Notifications';
import { PauseToggle } from '@/components/PauseToggle';
import { t } from '@/lib/i18n';
import { newRule, suggestRule, type Rule } from '@/lib/rules';
import { setRules } from '@/lib/store';
import { ImportExport } from './ImportExport';
import { Presets } from './Presets';
import { RuleEditor } from './RuleEditor';
import { RuleList } from './RuleList';
import '@/components/styles.css';
import './options.css';

interface Editing {
  rule: Rule;
  testUrl?: string;
}

/** The popup's "Add rule from this tab" opens this page with `#new=<url>`. */
function takeNewRuleFromHash(): Editing | undefined {
  const url = new URLSearchParams(location.hash.slice(1)).get('new');
  if (!url) return undefined;
  history.replaceState(null, '', location.pathname);
  return { rule: newRule(suggestRule(url)), testUrl: url };
}

function Options() {
  const { rules, paused } = useSettings();
  const [editing, setEditing] = useState<Editing | undefined>(takeNewRuleFromHash);
  const [saveError, setSaveError] = useState<string>();

  useEffect(() => {
    document.title = `${t('extName')} · ${t('openSettings')}`;
  }, []);

  const save = async (next: Rule[]) => {
    try {
      await setRules(next);
      setSaveError(undefined);
    } catch (e) {
      setSaveError(t('errSave', (e as Error).message));
    }
  };

  if (!rules) return null;

  const saveRule = (rule: Rule) => {
    const exists = rules.some((r) => r.id === rule.id);
    void save(exists ? rules.map((r) => (r.id === rule.id ? rule : r)) : [...rules, rule]);
    setEditing(undefined);
  };

  return (
    <main>
      <header>
        <div class="brand">
          <img src="/icon/128.png" alt="" />
          <h1>{t('extName')}</h1>
        </div>
        <PauseToggle paused={paused} />
      </header>

      <PinNudge />
      {paused && <p class="warning">{t('pausedBanner')}</p>}
      {saveError && <p class="error">{saveError}</p>}

      <section>
        <div class="section-head">
          <h2>{t('rules')}</h2>
          <button class="primary" onClick={() => setEditing({ rule: newRule() })}>
            {t('newRule')}
          </button>
        </div>
        <p class="muted">{t('rulesHelp')}</p>
        <RuleList rules={rules} onChange={(next) => void save(next)} onEdit={(rule) => setEditing({ rule })} />
      </section>

      <section>
        <h2>{t('notifications')}</h2>
        <NotifyToggle />
      </section>

      <section>
        <h2>{t('presets')}</h2>
        <p class="muted">{t('presetsHelp')}</p>
        <Presets rules={rules} onChange={(next) => void save(next)} />
      </section>

      <section>
        <h2>{t('importExport')}</h2>
        <ImportExport rules={rules} onChange={(next) => void save(next)} />
      </section>

      {editing && (
        <RuleEditor
          key={editing.rule.id}
          rule={editing.rule}
          initialTestUrl={editing.testUrl}
          onSave={saveRule}
          onCancel={() => setEditing(undefined)}
        />
      )}
    </main>
  );
}

render(<Options />, document.getElementById('app')!);
