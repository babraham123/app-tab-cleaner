import { useState } from 'preact/hooks';
import { t } from '@/lib/i18n';
import type { Rule } from '@/lib/rules';

interface Props {
  rules: Rule[];
  onChange: (rules: Rule[]) => void;
  onEdit: (rule: Rule) => void;
}

function move(rules: Rule[], from: number, to: number): Rule[] {
  const next = [...rules];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

export function RuleList({ rules, onChange, onEdit }: Props) {
  const [dragging, setDragging] = useState<number>();
  const [over, setOver] = useState<number>();

  const reorder = (from: number, to: number) => {
    if (to < 0 || to >= rules.length || from === to) return;
    const id = rules[from]!.id;
    onChange(move(rules, from, to));
    // Keep keyboard focus on the moved rule's handle after re-render.
    requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-handle="${id}"]`)?.focus());
  };

  const update = (rule: Rule) => onChange(rules.map((r) => (r.id === rule.id ? rule : r)));

  if (!rules.length) return <p class="muted">{t('noRules')}</p>;

  return (
    <ol class="rules">
      {rules.map((rule, i) => (
        <li
          key={rule.id}
          class={`rule${dragging === i ? ' dragging' : ''}${over === i && dragging !== i ? ' drop-target' : ''}`}
          draggable
          onDragStart={(e) => {
            setDragging(i);
            e.dataTransfer!.effectAllowed = 'move';
            e.dataTransfer!.setData('text/plain', rule.id);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(i);
          }}
          onDrop={(e) => {
            e.preventDefault();
            if (dragging !== undefined) reorder(dragging, i);
          }}
          onDragEnd={() => {
            setDragging(undefined);
            setOver(undefined);
          }}
        >
          <button
            class="handle"
            data-handle={rule.id}
            aria-label={t('reorderHandle', rule.name)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                e.preventDefault();
                reorder(i, i + (e.key === 'ArrowUp' ? -1 : 1));
              }
            }}
          >
            ⋮⋮
          </button>
          <label class="switch" title={t('enabled')}>
            <input
              type="checkbox"
              checked={rule.enabled}
              aria-label={`${t('enabled')}: ${rule.name}`}
              onChange={(e) => update({ ...rule, enabled: e.currentTarget.checked })}
            />
            <span class="switch-track" aria-hidden="true" />
          </label>
          <div class="rule-body">
            <div class="row">
              <strong>{rule.name}</strong>
              {rule.presetId && <span class="tag">{t('presetBadge')}</span>}
            </div>
            <code class="muted">{rule.include[0]}</code>
          </div>
          <span class="muted">{t('timeoutSummary', String(rule.timeoutSec))}</span>
          <button onClick={() => onEdit(rule)}>{t('edit')}</button>
          <button
            class="danger"
            onClick={() => {
              if (confirm(t('confirmDelete', rule.name))) onChange(rules.filter((r) => r.id !== rule.id));
            }}
          >
            {t('delete')}
          </button>
        </li>
      ))}
    </ol>
  );
}
