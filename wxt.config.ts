import preact from '@preact/preset-vite';
import { defineConfig } from 'wxt';

const FIREFOX_ID = '{a3961bff-1c64-40aa-a187-712c9c29a1cb}';

export default defineConfig({
  srcDir: 'src',
  manifestVersion: 3,
  manifest: ({ browser }) => ({
    name: '__MSG_extName__',
    description: '__MSG_extDescription__',
    default_locale: 'en',
    permissions: ['tabs', 'storage', 'alarms'],
    // Requested only if the user turns on "Notify before closing".
    optional_permissions: ['notifications'],
    action: { default_title: '__MSG_extName__' },
    ...(browser === 'firefox'
      ? {
          browser_specific_settings: {
            gecko: {
              id: FIREFOX_ID,
              // 140 (current ESR) is the first release that understands data_collection_permissions.
              strict_min_version: '140.0',
              data_collection_permissions: { required: ['none'] },
            },
          },
        }
      : { minimum_chrome_version: '121' }),
  }),
  vite: () => ({ plugins: [preact()] }),
});
