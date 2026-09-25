# Firefox Add-ons (AMO) listing

For the first submission at [addons.mozilla.org/developers/addon/submit](https://addons.mozilla.org/developers/addon/submit/). Build the files with `pnpm zip:firefox`.

## Upload step

- **Distribution:** On this site (listed)
- **Add-on file:** `.output/app-tab-cleaner-X.Y.Z-firefox.zip`
- **Compatibility:** Firefox for desktop only; leave Android unticked
- **Do you need to submit source code?** Yes. Upload `.output/app-tab-cleaner-X.Y.Z-sources.zip`, because the build output is bundled and minified.

## Describe add-on step

- **Name:** App Tab Cleaner (from the manifest)
- **Add-on URL:** `app-tab-cleaner`
- **Summary (≤250 chars):**

  ```
  Automatically closes the tabs left behind when links open desktop apps like Zoom, Slack, Microsoft Teams and Notion. Regex rules, per-rule timeouts, a countdown on the toolbar icon, and no data collection.
  ```

- **Description** (plain text; AMO keeps line breaks):

  ```
  Clicking a Zoom, Slack, Teams or Notion link opens the desktop app, and leaves a useless browser tab behind. App Tab Cleaner closes those tabs for you a few seconds after the app takes over.

  HOW IT WORKS
  • When a tab opens, navigates to or reloads a URL matching one of your rules, a countdown starts on the toolbar button (10 seconds by default).
  • When it reaches zero, the tab closes. If it was the last tab in the window, a new tab opens in its place so the window stays open.
  • Changed your mind? Click "Keep this tab" in the popup, or navigate the tab somewhere else, and it stays open.
  • Tip: pin the button to your toolbar from the extensions menu to see the countdown, or turn on "Notify before closing" in the settings.

  WORKS OUT OF THE BOX
  Built-in rules that recognise the "handoff" pages these apps leave behind, not their normal web versions:
  • Zoom: meeting links, once Zoom reports the desktop client launched
  • Slack: message and channel links that open in the app
  • Microsoft Teams: the "Open in Teams" launcher page
  • Notion: "open in desktop app" redirects
  • Discord: server invites
  • Linear: issue links handed off to the desktop app
  Figma and Spotify rules are included but off by default, since their handoff pages look identical to normal use.

  YOUR OWN RULES
  • Match any URL with regular expressions, with optional exceptions
  • Set a timeout per rule, from 0 seconds to an hour
  • Test patterns against a URL live in the rule editor
  • Drag to reorder rules; the first match wins
  • Pause everything with one switch
  • Import and export rules as JSON
  • Rules sync between your Firefox installs through Firefox Sync

  PRIVACY
  App Tab Cleaner collects nothing and makes no network requests. It has no host permissions, no content scripts, and never reads page content. It uses only:
  • tabs: to read tab URLs and close matching tabs
  • storage: to save your rules
  • alarms: to close tabs reliably after long timeouts
  • notifications (optional): only if you turn on "Notify before closing"

  Free and open source (MIT): https://github.com/babraham123/app-tab-cleaner
  ```

- **Categories:** Tabs
- **Tags** (if offered): tab manager, productivity
- **Support email:** leave empty
- **Support website:** https://github.com/babraham123/app-tab-cleaner/issues
- **License:** MIT License
- **Privacy policy:** tick "This add-on has a privacy policy" and paste the body of [PRIVACY.md](../../PRIVACY.md). The manifest already declares that no data is collected (`data_collection_permissions: none`).
- **Notes to reviewer:**

  ```
  Source is bundled with Vite (via WXT) and minified. To reproduce the uploaded build exactly:

  Requirements: Node.js 24, and pnpm 12.6.0 through Corepack (pinned in package.json "packageManager"). Tested on macOS and Ubuntu.

    corepack enable
    pnpm install --frozen-lockfile
    pnpm zip:firefox

  The output is .output/app-tab-cleaner-<version>-firefox.zip (unpacked in .output/firefox-mv3/). The same source is at https://github.com/babraham123/app-tab-cleaner.

  The linter's innerHTML warning comes from the Preact library (support for dangerouslySetInnerHTML); the extension's own code never uses it.

  To test: the Zoom preset closes https://zoom.us/j/1#success after 10 seconds. You can also add a rule matching ^https://example\.com/ in Settings, then open https://example.com/.
  ```

## Media step

AMO accepts the same images as the Chrome listing. Upload them from `store/chrome/`:

| File | Caption |
|---|---|
| `screenshot-1.png` | The popup counts down before closing a leftover tab |
| `screenshot-2.png` | Built-in rules for Zoom, Slack, Teams, Notion, Discord and Linear |
| `screenshot-3.png` | Write your own regex rules and test them live |
| `screenshot-4.png` | Minimal permissions and optional notifications |

- **Icon:** AMO takes it from the manifest, so nothing to upload.
