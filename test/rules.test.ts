import { describe, expect, it } from 'vitest';
import { exportRules, mergeRules, parseImport } from '@/lib/io';
import { PRESETS, markModified, presetToRule } from '@/lib/presets';
import { findRule, newRule, suggestRule, testRule, validateRule } from '@/lib/rules';

const preset = (id: string) => presetToRule(PRESETS.find((p) => p.id === id)!, { enabled: true });

describe('preset patterns', () => {
  it.each([
    ['zoom', 'https://acme.zoom.us/j/123456?pwd=abc#success', true],
    ['zoom', 'https://zoom.us/s/987#success', true],
    ['zoom', 'https://acme.zoom.us/j/123456?pwd=abc', false],
    ['zoom', 'https://zoom.us/profile#success', false],
    ['slack', 'https://acme.slack.com/archives/C123/p456', true],
    ['slack', 'https://slack.com/app_redirect?channel=C123', true],
    ['slack', 'https://app.slack.com/client/T1/C1', false],
    ['teams', 'https://teams.microsoft.com/dl/launcher/launcher.html?url=%2F_%23%2Fl%2Fmeetup-join', true],
    ['teams', 'https://teams.microsoft.com/l/meetup-join/19%3ameeting', false],
    ['notion', 'https://www.notion.so/native/Page-abc123?pvs=4&deepLinkOpenNewTab=true', true],
    ['notion', 'https://www.notion.so/Page-abc123', false],
    ['discord', 'https://discord.gg/abc123', true],
    ['discord', 'https://discord.com/invite/abc123', true],
    ['discord', 'https://discord.com/channels/1/2', false],
    ['linear', 'https://linear.app/acme/issue/ENG-1/title?noRedirect=1', true],
    ['linear', 'https://linear.app/acme/issue/ENG-1/title', false],
    ['linear', 'https://linear.app/acme/settings/api?noRedirect=1', false],
    ['figma', 'https://www.figma.com/design/AbC123/My-File', true],
    ['spotify', 'https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=x', true],
    ['spotify', 'https://open.spotify.com/', false],
  ])('%s: %s → %s', (id, url, expected) => {
    expect(testRule(preset(id), url).matched).toBe(expected);
  });
});

describe('matching', () => {
  it('reports which pattern included or excluded a URL', () => {
    const rule = newRule({ include: ['a\\.com', 'b\\.com'], exclude: ['keep'] });
    expect(testRule(rule, 'https://b.com/x')).toEqual({ matched: true, includedBy: 'b\\.com', excludedBy: undefined });
    expect(testRule(rule, 'https://a.com/keep')).toEqual({ matched: false, includedBy: 'a\\.com', excludedBy: 'keep' });
  });

  it('treats invalid patterns as non-matching', () => {
    expect(findRule([newRule({ include: ['('] })], 'https://x/(')).toBeUndefined();
  });
});

describe('validation', () => {
  it('accepts a complete rule', () => {
    expect(validateRule(newRule({ name: 'x', include: ['x'] }))).toEqual({});
  });

  it('flags missing name, missing or invalid patterns, and out-of-range timeouts', () => {
    const errors = validateRule(newRule({ name: ' ', include: [], exclude: ['('], timeoutSec: 3601 }));
    expect(errors.name?.key).toBe('errNameRequired');
    expect(errors.include?.key).toBe('errIncludeRequired');
    expect(errors.exclude).toMatchObject({ key: 'errInvalidPattern', subs: ['(', expect.any(String)] });
    expect(errors.timeoutSec?.key).toBe('errTimeout');
    expect(validateRule(newRule({ name: 'x', include: ['x'], timeoutSec: 1.5 })).timeoutSec).toBeDefined();
    expect(validateRule(newRule({ name: 'x', include: ['x'], timeoutSec: 0 })).timeoutSec).toBeUndefined();
  });
});

describe('suggestRule', () => {
  it('uses the escaped origin plus first path segment', () => {
    expect(suggestRule('https://acme.zoom.us/j/123?pwd=x')).toEqual({
      name: 'acme.zoom.us',
      include: ['^https://acme\\.zoom\\.us/j/'],
    });
    expect(suggestRule('http://localhost:3000')).toEqual({ name: 'localhost', include: ['^http://localhost:3000/'] });
  });

  it('refuses non-web URLs', () => {
    expect(suggestRule('chrome://extensions')).toBeUndefined();
    expect(suggestRule('not a url')).toBeUndefined();
  });

  it('produces a pattern that matches the source URL', () => {
    const url = 'https://acme.zoom.us/j/123?pwd=x';
    expect(testRule({ include: suggestRule(url)!.include, exclude: [] }, url).matched).toBe(true);
  });
});

describe('preset modification tracking', () => {
  const zoom = preset('zoom');

  it('marks pattern or name edits as modified', () => {
    expect(markModified(zoom, { ...zoom, include: ['x'] }).modified).toBe(true);
    expect(markModified(zoom, { ...zoom, name: 'Z' }).modified).toBe(true);
  });

  it('does not count enabled or timeout changes', () => {
    expect(markModified(zoom, { ...zoom, enabled: false, timeoutSec: 5 }).modified).toBe(false);
  });
});

describe('import/export', () => {
  const a = newRule({ id: 'a', name: 'A', include: ['a'] });
  const b = newRule({ id: 'b', name: 'B', include: ['b'] });

  it('round-trips rules', () => {
    expect(parseImport(exportRules([a, b]))).toEqual({ rules: [a, b] });
  });

  it('merges by id by default and replaces on request', () => {
    const a2 = { ...a, name: 'A2' };
    const c = newRule({ id: 'c', name: 'C', include: ['c'] });
    expect(mergeRules([a, b], [a2, c], false)).toEqual([a2, b, c]);
    expect(mergeRules([a, b], [c], true)).toEqual([c]);
  });

  it('rejects bad JSON, unknown versions and invalid rules', () => {
    expect(parseImport('{')).toEqual({ error: { key: 'errImportJson' } });
    expect(parseImport('{"version":2,"rules":[]}')).toMatchObject({ error: { key: 'errImportFormat' } });
    expect(parseImport(JSON.stringify({ version: 1, rules: [{ name: 'x', include: ['('], timeoutSec: 5 }] }))).toMatchObject({
      error: { key: 'errImportRule', subs: ['1'] },
      cause: { key: 'errInvalidPattern' },
    });
  });
});
