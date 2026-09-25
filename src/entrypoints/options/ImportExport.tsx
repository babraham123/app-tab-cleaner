import { useState } from 'preact/hooks';
import { errorText } from '@/components/Message';
import { t } from '@/lib/i18n';
import { exportRules, mergeRules, parseImport } from '@/lib/io';
import type { Rule } from '@/lib/rules';

export function ImportExport({ rules, onChange }: { rules: Rule[]; onChange: (rules: Rule[]) => void }) {
  const [text, setText] = useState('');
  const [replace, setReplace] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string }>();

  const download = () => {
    const url = URL.createObjectURL(new Blob([exportRules(rules)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'app-tab-cleaner-rules.json' });
    a.click();
    URL.revokeObjectURL(url);
  };

  const apply = (json: string) => {
    const parsed = parseImport(json);
    if ('error' in parsed) {
      setResult({ ok: false, message: [errorText(parsed.error), errorText(parsed.cause)].filter(Boolean).join(' ') });
      return;
    }
    onChange(mergeRules(rules, parsed.rules, replace));
    setResult({ ok: true, message: t('importDone', String(parsed.rules.length)) });
    setText('');
  };

  return (
    <div class="import-export">
      <div class="row" style={{ flexWrap: 'wrap' }}>
        <button onClick={download}>{t('export')}</button>
        <label class="file-button">
          <input
            type="file"
            accept="application/json,.json"
            onChange={async (e) => {
              const file = e.currentTarget.files?.[0];
              e.currentTarget.value = '';
              if (file) apply(await file.text());
            }}
          />
          <span>{t('importFile')}</span>
        </label>
      </div>
      <label>
        <span>{t('importPaste')}</span>
        <textarea rows={4} spellcheck={false} value={text} onInput={(e) => setText(e.currentTarget.value)} />
      </label>
      <div class="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <label class="row">
          <input type="checkbox" checked={replace} onChange={(e) => setReplace(e.currentTarget.checked)} />
          <span>{t('importReplace')}</span>
        </label>
        <button class="primary" disabled={!text.trim()} onClick={() => apply(text)}>
          {t('importApply')}
        </button>
      </div>
      {result && (
        <p class={result.ok ? 'test-ok' : 'error'} role="status">
          {result.message}
        </p>
      )}
    </div>
  );
}
