import { useState } from 'preact/hooks';
import { t } from '@/lib/i18n';
import { removeNotificationPermission, requestNotificationPermission } from '@/lib/notifications';
import { setNotify } from '@/lib/store';
import { useNotificationPermission, usePinned, useSettings } from './hooks';

/** Notifications count as on only when the synced setting is on and this device granted the permission. */
export function useNotificationsEnabled() {
  const { notify } = useSettings();
  const granted = useNotificationPermission();
  return notify && granted;
}

function useEnableNotifications() {
  const [denied, setDenied] = useState(false);
  const enable = () => {
    // permissions.request must run synchronously inside the click handler.
    void requestNotificationPermission().then(async (granted) => {
      setDenied(!granted);
      if (granted) await setNotify(true);
    });
  };
  return { enable, denied };
}

export function NotifyToggle() {
  const enabled = useNotificationsEnabled();
  const { enable, denied } = useEnableNotifications();
  return (
    <div>
      <label class="switch">
        <input
          type="checkbox"
          role="switch"
          checked={enabled}
          onChange={(e) => {
            if (e.currentTarget.checked) enable();
            else void setNotify(false).then(removeNotificationPermission);
          }}
        />
        <span class="switch-track" aria-hidden="true" />
        <span>{t('notifySetting')}</span>
      </label>
      <p class="muted" style={{ margin: '4px 0 0' }}>
        {t('notifySettingHelp')}
      </p>
      {denied && <p class="error">{t('notifyDenied')}</p>}
    </div>
  );
}

/** Shown when the toolbar icon (and so the badge countdown) is hidden and notifications are off. */
export function PinNudge() {
  const pinned = usePinned();
  const enabled = useNotificationsEnabled();
  const { enable, denied } = useEnableNotifications();
  if (pinned || enabled) return null;
  return (
    <div class="warning nudge" role="note">
      <p>{t('pinNudge')}</p>
      <div class="row">
        <span>{t('pinNudgeNotify')}</span>
        <button onClick={enable}>{t('enableNotifications')}</button>
      </div>
      {denied && <p class="error">{t('notifyDenied')}</p>}
    </div>
  );
}
