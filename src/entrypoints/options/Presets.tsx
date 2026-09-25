import { t } from '@/lib/i18n';
import { PRESETS, presetToRule, resetToPreset } from '@/lib/presets';
import type { Rule } from '@/lib/rules';

export function Presets({ rules, onChange }: { rules: Rule[]; onChange: (rules: Rule[]) => void }) {
  return (
    <ul class="presets">
      {PRESETS.map((preset) => {
        const existing = rules.find((r) => r.presetId === preset.id);
        const outdated = existing && (existing.modified || (existing.presetVersion ?? 0) < preset.version);
        return (
          <li key={preset.id} class="preset">
            <div>
              <strong>{preset.name}</strong>
              <p class="muted">{t(preset.descriptionKey)}</p>
              {preset.warningKey && <p class="warning">{t(preset.warningKey)}</p>}
            </div>
            {!existing ? (
              <button onClick={() => onChange([...rules, presetToRule(preset)])}>{t('addPreset')}</button>
            ) : outdated ? (
              <button
                onClick={() => onChange(rules.map((r) => (r.id === existing.id ? resetToPreset(r, preset) : r)))}
              >
                {t('resetPreset')}
              </button>
            ) : (
              <button disabled>{t('presetAdded')}</button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
