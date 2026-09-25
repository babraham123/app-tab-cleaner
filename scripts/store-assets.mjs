// Renders Chrome Web Store listing images into store/chrome/ from the built extension.
// Run `pnpm build` first; needs a Playwright Chromium (`pnpm exec playwright install chromium`).
/* global chrome -- sw.evaluate() callbacks run inside the extension service worker */
import { cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { chromium } from 'playwright';

const root = new URL('..', import.meta.url).pathname;
const out = join(root, 'store/chrome');
mkdirSync(out, { recursive: true });

const iconSvg = readFileSync(join(root, 'assets/icon.svg'), 'utf8');
const iconDataUri = `data:image/svg+xml;base64,${Buffer.from(iconSvg).toString('base64')}`;

// Store icon: 96px artwork centred in a transparent 128px canvas, per the CWS image guidelines.
const inner = iconSvg.replace('<svg ', '<svg x="16" y="16" width="96" height="96" ');
const padded = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">${inner}</svg>`;
writeFileSync(join(out, 'store-icon-128.png'), new Resvg(padded).render().asPng());

// Grant notifications up front in a copy of the build, so the UI shows the fully set-up state
// (no pin nudge) without a permission prompt.
const ext = mkdtempSync(join(tmpdir(), 'atc-store-'));
cpSync(join(root, '.output/chrome-mv3'), ext, { recursive: true });
const manifest = JSON.parse(readFileSync(join(ext, 'manifest.json'), 'utf8'));
manifest.permissions.push('notifications');
delete manifest.optional_permissions;
writeFileSync(join(ext, 'manifest.json'), JSON.stringify(manifest));

const ctx = await chromium.launchPersistentContext('', {
  channel: 'chromium',
  headless: true,
  colorScheme: 'light',
  deviceScaleFactor: 2,
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});
const sw = ctx.serviceWorkers()[0] ?? (await ctx.waitForEvent('serviceworker'));
const id = sw.url().split('/')[2];
await sw.evaluate(async () => {
  for (let i = 0; i < 50 && !(await chrome.storage.sync.get('rules')).rules; i++) {
    await new Promise((r) => setTimeout(r, 100));
  }
});

// The popup reads the active tab, which here is the popup page itself; a temporary rule named
// "Zoom" that matches it produces a realistic countdown.
await sw.evaluate(async () => {
  const { rules } = await chrome.storage.sync.get('rules');
  const demo = { id: 'demo', name: 'Zoom', include: ['/popup\\.html'], exclude: [], timeoutSec: 10, enabled: true };
  await chrome.storage.sync.set({ rules: [demo, ...rules] });
});
const popup = await ctx.newPage();
await popup.setViewportSize({ width: 320, height: 400 });
await popup.goto(`chrome-extension://${id}/popup.html`);
await popup.waitForTimeout(2200);
const popupShot = await popup.locator('main').screenshot();
await popup.close().catch(() => {});
await sw.evaluate(async () => {
  const { rules } = await chrome.storage.sync.get('rules');
  await chrome.storage.sync.set({ rules: rules.filter((r) => r.id !== 'demo') });
});

const options = await ctx.newPage();
await options.setViewportSize({ width: 820, height: 1400 });
await options.goto(`chrome-extension://${id}/options.html`);
await options.waitForSelector('.rule');
// End the crop just below the last enabled preset so no row is cut in half.
const lastRow = await options.locator('.rule', { hasText: 'Linear' }).boundingBox();
const rulesShot = await options.screenshot({ clip: { x: 0, y: 0, width: 820, height: lastRow.y + lastRow.height + 6 } });
// The OS-settings tip is useful in the product but noise in a store image.
await options.addStyleTag({ content: '.tip { display: none }' });
const notifySection = options.locator('section', { hasText: 'Notify before closing' });
await notifySection.evaluate((el) => (el.style.padding = '20px 24px'));
const notifyShot = await notifySection.screenshot();

await options.locator('.rule', { hasText: 'Zoom' }).getByRole('button', { name: 'Edit' }).click();
await options.fill('.editor input[type=url]', 'https://acme.zoom.us/j/123456789?pwd=abc#success');
const editorShot = await options.locator('.editor').screenshot();

const uri = (png) => `data:image/png;base64,${png.toString('base64')}`;
const card = (png, width) =>
  `<img src="${uri(png)}" style="width:${width}px;border-radius:14px;background:#fff;box-shadow:0 30px 80px rgb(20 10 60 / .35)">`;

const frame = ({ title, body, visual, brand = false }) => `
  <body style="margin:0;width:1280px;height:800px;box-sizing:border-box;padding:0 80px;display:flex;align-items:center;gap:64px;
    background:linear-gradient(135deg,#5b4bf5,#a24bea);color:#fff;font-family:system-ui,-apple-system,sans-serif">
    <div style="flex:0 0 420px">
      ${brand ? `<div style="display:flex;align-items:center;gap:14px;margin-bottom:36px"><img src="${iconDataUri}" width="56"><span style="font-size:26px;font-weight:600">App Tab Cleaner</span></div>` : ''}
      <h1 style="font-size:48px;line-height:1.08;margin:0 0 22px;letter-spacing:-.5px">${title}</h1>
      <p style="font-size:22px;line-height:1.45;margin:0;opacity:.92">${body}</p>
    </div>
    <div style="flex:1;display:flex;justify-content:center;align-items:center;gap:24px">${visual}</div>
  </body>`;

const permissionList = `
  <div style="display:grid;gap:14px;font-size:20px">
    ${[
      ['tabs', 'read tab URLs to match your rules and close tabs'],
      ['storage', 'save your rules'],
      ['alarms', 'close reliably after long timeouts'],
      ['notifications', 'optional, only if you turn them on'],
    ]
      .map(
        ([name, why]) =>
          `<div style="background:rgb(255 255 255 / .14);border-radius:12px;padding:14px 18px"><b style="font-family:ui-monospace,Menlo,monospace">${name}</b> · ${why}</div>`,
      )
      .join('')}
  </div>`;

const screenshots = [
  {
    brand: true,
    title: 'Close the tabs desktop apps leave behind',
    body: 'Zoom, Slack, Teams and Notion links open their desktop apps and leave a dead tab behind. App Tab Cleaner closes it after a few seconds.',
    visual: card(popupShot, 380),
  },
  {
    title: 'Works out of the box',
    body: 'Built-in rules for Zoom, Slack, Microsoft Teams, Notion, Discord and Linear. Edit, reorder or turn off any of them.',
    visual: card(rulesShot, 640),
  },
  {
    title: 'Your own rules, tested live',
    body: 'Match any URL with a regular expression, add exceptions, and set a timeout per rule. The built-in tester shows exactly what will close.',
    visual: card(editorShot, 600),
  },
  {
    title: 'Minimal permissions. No data collected.',
    body: 'No host permissions, no content scripts, no network requests. Get an optional notification before a tab closes, with one click to keep it.',
    visual: `<div style="display:grid;gap:22px;width:640px">${permissionList}${card(notifyShot, 640)}</div>`,
  },
];

const render = await ctx.newPage();
for (const [i, s] of screenshots.entries()) {
  await render.setViewportSize({ width: 1280, height: 800 });
  await render.setContent(frame(s));
  await render.screenshot({ path: join(out, `screenshot-${i + 1}.png`), scale: 'css' });
}

await render.setViewportSize({ width: 440, height: 280 });
await render.setContent(`
  <body style="margin:0;width:440px;height:280px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;
    background:linear-gradient(135deg,#5b4bf5,#a24bea);color:#fff;font-family:system-ui,-apple-system,sans-serif;text-align:center">
    <img src="${iconDataUri}" width="88">
    <div style="font-size:30px;font-weight:700">App Tab Cleaner</div>
    <div style="font-size:16px;opacity:.92;max-width:340px">Auto-close the tabs Zoom, Slack, Teams &amp; Notion links leave behind</div>
  </body>`);
await render.screenshot({ path: join(out, 'promo-small-440x280.png'), scale: 'css' });

await ctx.close();
console.log(`Wrote store assets to ${out}`);
