import { useEffect, useState } from 'preact/hooks';
import { browser } from 'wxt/browser';
import { t } from '@/lib/i18n';
import { removeNotificationPermission, requestNotificationPermission } from '@/lib/notifications';
import { useNotificationPermission, usePinned } from './hooks';

function useEnableNotifications() {
  const [denied, setDenied] = useState(false);
  // permissions.request must run synchronously inside the click handler.
  const enable = () => void requestNotificationPermission().then((granted) => setDenied(!granted));
  return { enable, denied };
}

export function NotifyToggle() {
  const enabled = useNotificationPermission();
  const { enable, denied } = useEnableNotifications();
  return (
    <div>
      <label class="switch">
        <input
          type="checkbox"
          role="switch"
          checked={enabled}
          onChange={(e) => {
            const wantOn = e.currentTarget.checked;
            // Only the permission itself decides the state; undo the click until it changes.
            e.currentTarget.checked = enabled;
            if (wantOn) enable();
            else void removeNotificationPermission();
          }}
        />
        <span class="switch-track" aria-hidden="true" />
        <span>{t('notifySetting')}</span>
      </label>
      <p class="muted" style={{ margin: '4px 0 0' }}>
        {t('notifySettingHelp')}
      </p>
      {denied && <p class="error">{t('notifyDenied')}</p>}
      {enabled && <OsNotificationTip />}
    </div>
  );
}

const OS_TIP_KEYS: Partial<Record<string, string>> = { mac: 'notifyOsTipMac', win: 'notifyOsTipWin' };

/** The browser happily "creates" notifications the OS then drops, so point at the OS setting. */
function OsNotificationTip() {
  const [os, setOs] = useState<string>();
  useEffect(() => {
    void browser.runtime.getPlatformInfo().then((info) => setOs(info.os));
  }, []);
  const osKey = os && OS_TIP_KEYS[os];
  return (
    <div class="tip">
      <p>{t('notifyOsTip')}</p>
      {osKey && <p>{t(osKey)}</p>}
    </div>
  );
}

/** Shown when the toolbar icon (and so the badge countdown) is hidden and notifications are off. */
export function PinNudge() {
  const pinned = usePinned();
  const enabled = useNotificationPermission();
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
