/**
 * Every key the screens ask for, the dictionaries answer.
 *
 * `i18n.spec` guards the three dictionaries against each other — that none of
 * them is behind the others. This guards them against the code, which is a
 * different mistake and the one that actually shipped: a component written with
 * six new `t('detail.superseded…')` calls and no dictionary entry for any of
 * them passes that test, because all three are equally missing. It reached the
 * screen as `DETAIL.SUPERSEDED` beside a document, in every language, and no
 * unit test had anything to say about it (COMM-81).
 *
 * `t` is what makes this invisible at runtime: a key it has no word for is
 * echoed back, so an untranslated string renders looking like a working one and
 * only a person opening the page sees it. That is the fallback's whole purpose
 * for a key composed from data the wire sent — `doctype.<key>` for a type this
 * build has never heard of — and the reason `translateOr` exists to make that
 * case deliberate. So only literal keys are checked here: a key the source spells
 * out is a key the author meant to have a word for.
 */
import { describe, expect, it } from 'vitest';

import { DICTS, LOCALES } from './i18n';

/**
 * Every source file of the app, as text.
 *
 * Vite's own glob rather than `node:fs`, because this app is typed for a browser
 * and has no node types — and because the transform already knows where the
 * sources are. Eager, so the map is ready when the suite is collected.
 */
const SOURCES: Record<string, string> = import.meta.glob(
  ['../../**/*.ts', '../../**/*.tsx'],
  { query: '?raw', import: 'default', eager: true },
);

const LITERAL_KEY = /\bt\(\s*'([a-z][a-zA-Z0-9_.]*)'/g;

describe('every key a screen asks for', () => {
  const asked = new Map<string, string[]>();

  for (const [file, text] of Object.entries(SOURCES)) {
    if (file.includes('/i18n/') || file.endsWith('.spec.ts')) continue;
    for (const [, key] of text.matchAll(LITERAL_KEY)) {
      const where = file.replace('../../', '');
      asked.set(key, [...(asked.get(key) ?? []), where]);
    }
  }

  it('finds keys to check at all — a scan that matches nothing proves nothing', () => {
    expect(asked.size).toBeGreaterThan(100);
  });

  it.each(LOCALES.map(l => l.id))('%s has a word for each of them', locale => {
    const dict = DICTS[locale];
    const missing = [...asked]
      .filter(([key]) => !(key in dict))
      .map(([key, files]) => `${key} (${[...new Set(files)].join(', ')})`)
      .sort();

    expect(missing).toEqual([]);
  });
});
