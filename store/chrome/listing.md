# Chrome Web Store listing

Copy these into the [developer dashboard](https://chrome.google.com/webstore/devconsole). Regenerate the images with `pnpm store-assets`.

## Store listing tab

**Name and summary** come from the manifest (`_locales/en/messages.json`):
- **Name:** App Tab Cleaner
- **Summary (≤132 chars):** Automatically closes tabs left behind after links open in desktop apps like Zoom, Slack, Teams and Notion.

**Category:** Productivity → Workflow & Planning

**Language:** English

**Description** (plain text; the store doesn't render Markdown):

```
Clicking a Zoom, Slack, Teams or Notion link opens the desktop app, and leaves a useless browser tab behind. App Tab Cleaner closes those tabs for you a few seconds after the app takes over.

HOW IT WORKS
• When a tab opens, navigates to or reloads a URL matching one of your rules, a countdown starts on the toolbar icon (10 seconds by default).
• When it reaches zero, the tab closes. If it was the last tab in the window, a new tab opens in its place so the window stays open.
• Changed your mind? Click "Keep this tab" in the popup, or navigate the tab somewhere else, and it stays open.

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
• Rules sync across your browsers through the browser's own sync

PRIVACY
App Tab Cleaner collects nothing and makes no network requests. It has no host permissions, no content scripts, and never reads page content. It uses only:
• tabs: to read tab URLs and close matching tabs
• storage: to save your rules
• alarms: to close tabs reliably after long timeouts
• notifications (optional): only if you turn on "Notify before closing"

Free and open source (MIT): https://github.com/babraham123/app-tab-cleaner
```

**Graphic assets** (all in this folder):

| Field | File |
|---|---|
| Store icon (128×128) | `store-icon-128.png` |
| Screenshots (1280×800), in order | `screenshot-1.png` … `screenshot-4.png` |
| Small promo tile (440×280) | `promo-small-440x280.png` |
| Marquee promo tile | Leave empty (optional) |

**Additional fields**
- **Official URL:** None
- **Homepage URL:** https://github.com/babraham123/app-tab-cleaner
- **Support URL:** https://github.com/babraham123/app-tab-cleaner/issues
- **Mature content:** No

## Privacy tab

**Single purpose:**

```
Automatically closes browser tabs whose URL matches user-defined patterns after a timeout: typically the leftover pages from links that open desktop apps such as Zoom, Slack, Microsoft Teams and Notion.
```

**Permission justifications:**

| Permission | Justification |
|---|---|
| `tabs` | Reads the URL of tabs as they load to check them against the user's rules, and closes tabs that match. URLs are compared in memory only and are never stored or transmitted. |
| `storage` | Saves the user's rules and pause setting. Pending countdowns are kept in session storage so they survive the background service worker restarting. |
| `alarms` | Backup timer so a tab still closes when its countdown outlasts the service worker's idle lifetime (about 30 seconds). |
| `notifications` (optional) | Requested only when the user turns on "Notify before closing". Shows a local notification that a tab is about to close; clicking it keeps the tab open. |

**Remote code:** No, I am not using remote code.

**Data usage:**
- Leave every data-collection category unchecked.
- Tick all three certifications: no selling or transferring data, no unrelated use, no creditworthiness or lending use.

**Privacy policy URL:** https://github.com/babraham123/app-tab-cleaner/blob/main/PRIVACY.md

## Distribution tab

- **Payments:** Free
- **Visibility:** Public
- **Regions:** All regions
