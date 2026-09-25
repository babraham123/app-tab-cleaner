import { useEffect, useRef, useState } from 'preact/hooks';
import { FieldError } from '@/components/Message';
import { t } from '@/lib/i18n';
import { getPreset, markModified } from '@/lib/presets';
import {
  RELIABLE_TIMEOUT_SEC,
  isValid,
  splitLines,
  testRule,
  validateRule,
  type Rule,
} from '@/lib/rules';

interface Props {
  rule: Rule;
  initialTestUrl?: string;
  onSave: (rule: Rule) => void;
  onCancel: () => void;
}

export function RuleEditor({ rule, initialTestUrl = '', onSave, onCancel }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(rule.name);
  const [include, setInclude] = useState(rule.include.join('\n'));
  const [exclude, setExclude] = useState(rule.exclude.join('\n'));
  const [timeoutText, setTimeoutText] = useState(String(rule.timeoutSec));
  const [enabled, setEnabled] = useState(rule.enabled);
  const [testUrl, setTestUrl] = useState(initialTestUrl);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => dialog.current?.showModal(), []);

  const draft: Rule = {
    ...rule,
    name: name.trim(),
    include: splitLines(include),
    exclude: splitLines(exclude),
    timeoutSec: timeoutText.trim() === '' ? NaN : Number(timeoutText),
    enabled,
  };
  const errors = validateRule(draft);
  // Pattern errors are useful while typing; the rest wait until the first save attempt.
  const shown = submitted ? errors : { include: draft.include.length ? errors.include : undefined, exclude: errors.exclude };
  const warningKey = getPreset(rule.presetId)?.warningKey;
  const test = testUrl.trim() ? testRule(draft, testUrl.trim()) : undefined;

  const save = (e: Event) => {
    e.preventDefault();
    setSubmitted(true);
    if (isValid(errors)) onSave(markModified(rule, draft));
  };

  return (
    <dialog ref={dialog} class="editor" onClose={onCancel}>
      <form onSubmit={save} novalidate>
        <h2>{rule.name ? rule.name : t('newRule')}</h2>
        {warningKey && <p class="warning">{t(warningKey)}</p>}

        <label>
          <span>{t('fieldName')}</span>
          <input type="text" value={name} onInput={(e) => setName(e.currentTarget.value)} />
          <FieldError error={shown.name} />
        </label>

        <label>
          <span>{t('fieldInclude')}</span>
          <textarea rows={3} spellcheck={false} value={include} onInput={(e) => setInclude(e.currentTarget.value)} />
          <small class="muted">{t('fieldIncludeHelp')}</small>
          <FieldError error={shown.include} />
        </label>

        <label>
          <span>{t('fieldExclude')}</span>
          <textarea rows={2} spellcheck={false} value={exclude} onInput={(e) => setExclude(e.currentTarget.value)} />
          <small class="muted">{t('fieldExcludeHelp')}</small>
          <FieldError error={shown.exclude} />
        </label>

        <div class="row" style={{ alignItems: 'flex-start', gap: '24px' }}>
          <label style={{ width: '160px' }}>
            <span>{t('fieldTimeout')}</span>
            <input
              type="number"
              min={0}
              max={3600}
              step={1}
              value={timeoutText}
              onInput={(e) => setTimeoutText(e.currentTarget.value)}
            />
          </label>
          <label class="switch" style={{ marginTop: '26px' }}>
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.currentTarget.checked)} />
            <span class="switch-track" aria-hidden="true" />
            <span>{t('enabled')}</span>
          </label>
        </div>
        <FieldError error={shown.timeoutSec} />
        {draft.timeoutSec > RELIABLE_TIMEOUT_SEC && (
          <p class="warning">{t('timeoutWarning', String(RELIABLE_TIMEOUT_SEC))}</p>
        )}

        <label>
          <span>{t('fieldTester')}</span>
          <input
            type="url"
            placeholder={t('testerPlaceholder')}
            value={testUrl}
            onInput={(e) => setTestUrl(e.currentTarget.value)}
          />
          {test && (
            <p class={test.matched ? 'test-ok' : 'error'} aria-live="polite">
              {test.matched
                ? t('testerMatch', test.includedBy!)
                : test.excludedBy
                  ? t('testerExcluded', test.excludedBy)
                  : t('testerNoMatch')}
            </p>
          )}
        </label>

        <div class="row" style={{ justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => dialog.current?.close()}>
            {t('cancel')}
          </button>
          <button type="submit" class="primary">
            {t('save')}
          </button>
        </div>
      </form>
    </dialog>
  );
}
