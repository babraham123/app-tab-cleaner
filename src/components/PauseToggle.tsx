import { t } from '@/lib/i18n';
import { setPaused } from '@/lib/store';

export function PauseToggle({ paused }: { paused: boolean }) {
  return (
    <label class="switch">
      <input type="checkbox" role="switch" checked={paused} onChange={(e) => void setPaused(e.currentTarget.checked)} />
      <span class="switch-track" aria-hidden="true" />
      <span>{t('pause')}</span>
    </label>
  );
}
