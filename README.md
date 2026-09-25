<p align="center"><img src="assets/icon.svg" width="96" alt=""></p>

# App Tab Cleaner

A Chrome and Firefox extension that closes the tabs left behind when a link hands off to a desktop app (Zoom, Slack, Teams, Notion, Discord, Linear, …). When a tab's URL matches one of your regex rules, it closes after that rule's timeout (10 seconds by default).

- **Minimal permissions:** `tabs`, `storage` and `alarms`, plus an optional `notifications` permission that's only requested if you turn notifications on. No host permissions, no content scripts, no network requests. See [PRIVACY.md](PRIVACY.md).
- **Presets** for common apps, which you can edit, disable or delete.
- **Countdown on the toolbar badge**, plus a **Keep this tab** button in the popup. If the icon isn't pinned, the popup and settings suggest pinning it, or turning on **Notify before closing**. That shows a system notification you can click to keep the tab.
- **Global pause**, JSON **import/export**, and a live **URL tester** in the rule editor.

## How it works

- The countdown starts when a tab is created with, navigates to, or reloads a URL that matches a rule.
- Rules are checked top to bottom and the first match wins. A rule matches when any of its *include* patterns match the full URL and none of its *exclude* patterns do. Matching is case-insensitive.
- Navigating to a URL that doesn't match cancels the countdown. That's what "continue in browser" links do.
- These tabs are never closed:
  - pinned tabs
  - tabs you chose to keep
  - tabs that were already open when the browser started or the extension was installed, until they navigate somewhere new
- If the matching tab is the last one in its window, a new tab opens first so the window stays open.
- Timeouts range from 0 to 3600 seconds. Anything over 25 seconds relies on `chrome.alarms` as a backup, because MV3 background workers can be suspended, so those may run a few seconds late.

### Presets

| Preset | Default | Matches |
|---|---|---|
| Zoom | on | Meeting links once Zoom appends `#success` (the desktop client launched) |
| Slack | on | `archives/…`, `app_redirect`, `ssb/redirect` handoff pages |
| Microsoft Teams | on | The `dl/launcher/launcher.html` page |
| Notion | on | `/native/…?deepLinkOpenNewTab=true` redirects |
| Discord | on | Invite pages |
| Linear | on | Issue links with `noRedirect=1` |
| Figma | off | Design and file links. There's no handoff marker, so this also closes tabs you use in the browser |
| Spotify | off | Track, album and playlist links. Same caveat as Figma |

Presets you haven't edited are updated when the extension updates. Once you edit a preset's name or patterns, it's yours and is never changed automatically.

## Development

Requires Node 24 and pnpm (`corepack enable`).

```sh
pnpm install
pnpm dev            # Chrome, with hot reload
pnpm dev:firefox    # Firefox
pnpm test           # Vitest integration tests of the background logic
pnpm lint           # ESLint + tsc
pnpm zip && pnpm zip:firefox   # Store-ready zips in .output/
pnpm icons          # Re-render PNG icons from assets/icon.svg
```

Built with [WXT](https://wxt.dev), TypeScript and Preact.

| Path | Contents |
|---|---|
| `src/lib/background.ts` | Tab watching, scheduling and closing |
| `src/lib/rules.ts` | Matching and validation |
| `src/lib/presets.ts` | Built-in presets |
| `src/entrypoints/popup`, `src/entrypoints/options` | UI |
| `public/_locales/en/messages.json` | All UI strings. Translations are welcome |

## Releasing

```sh
npm version patch     # bumps package.json, commits, and tags vX.Y.Z
git push --follow-tags
```

The tag triggers CI in this order:

1. Lint, test and build.
2. Check that the tag matches `package.json`.
3. Attach the zips to a GitHub release.
4. Submit the same zips to the Chrome Web Store and Firefox Add-ons.

Store submission runs in the `web-stores` GitHub environment. Each store is skipped, with a warning, until its secrets are set.

### One-time store setup

Both stores need the **first** version uploaded by hand. After that, CI handles updates.

**Chrome Web Store** (uses API v2 with a service account)

1. Upload `app-tab-cleaner-X.Y.Z-chrome.zip` in the [developer dashboard](https://chrome.google.com/webstore/devconsole) and fill in the listing:
   - Link [PRIVACY.md](PRIVACY.md) as the privacy policy.
   - Justify each permission: `tabs`, `storage`, `alarms`, and the optional `notifications`.
2. Create a service account, following [Google's guide](https://developer.chrome.com/docs/webstore/service-accounts):
   - In a Google Cloud project, enable the Chrome Web Store API.
   - Create the service account, download a JSON key, and add the account's email in the dashboard's account settings.
3. Add these secrets to the `web-stores` environment:
   - `CHROME_EXTENSION_ID`: from the item's dashboard URL.
   - `CHROME_PUBLISHER_ID`: from `https://chrome.google.com/webstore/devconsole/<publisher-id>`.
   - `CHROME_SERVICE_ACCOUNT_CLIENT_EMAIL`: `client_email` from the JSON key.
   - `CHROME_SERVICE_ACCOUNT_PRIVATE_KEY`: `private_key` from the JSON key, with real newlines rather than `\n`.

**Firefox Add-ons**

1. [Submit a new add-on](https://addons.mozilla.org/developers/addon/submit/) as a listed add-on, using `app-tab-cleaner-X.Y.Z-firefox.zip`. When asked for source code, upload `…-sources.zip`.
2. Create API credentials at [addons.mozilla.org/developers/addon/api/key](https://addons.mozilla.org/developers/addon/api/key/).
3. Add these secrets to the `web-stores` environment:
   - `FIREFOX_JWT_ISSUER`
   - `FIREFOX_JWT_SECRET`

The add-on ID is fixed in `wxt.config.ts`.

**Checking credentials:** under Actions → CI → **Run workflow**, keep "dry run" ticked. The job authenticates with each configured store without uploading anything.

## License

[MIT](LICENSE)
