# Privacy policy

App Tab Cleaner does not collect, transmit, sell or share any data. There are no analytics, no telemetry and no network requests.

## What the extension accesses

| Permission | Why | Where the data goes |
|---|---|---|
| `tabs` | Read tab URLs to check them against your rules, and close matching tabs. | Nowhere. URLs are compared in memory and never stored or sent anywhere. |
| `storage` | Save your rules and the pause setting. Pending countdowns are kept in session storage so they survive the background worker restarting. | Your browser's extension storage. If you use browser sync, your browser syncs the rules between your own devices; the extension itself never sends them anywhere. |
| `alarms` | Close tabs reliably when a timeout is longer than about 25 seconds. | Nowhere. |

The extension has no host permissions and never reads page content.

## Contact

Open an issue at https://github.com/babraham123/app-tab-cleaner/issues.
