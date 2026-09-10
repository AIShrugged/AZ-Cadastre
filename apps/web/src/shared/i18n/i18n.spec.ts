/**
 * The trilingual rule, enforced.
 *
 * RU / EN / AZ is a product constraint, and a missing word does not fail loudly:
 * `t` falls back to English and then to the key itself, so an untranslated
 * string ships looking like a working one. The catalogue of document types is
 * the reason this is now worth a test — it arrives as ~50 keys at a time and
 * will grow again, and a key added to one dictionary and forgotten in another
 * is exactly the mistake a hand-edited list of that size invites.
 */
import { describe, expect, it } from 'vitest';

import { DICTS, LOCALES } from './i18n';
import { translateOr } from './translate-or';

describe('dictionaries', () => {
  const locales = LOCALES.map(l => l.id);

  it('covers every locale the switcher offers', () => {
    expect(Object.keys(DICTS).sort()).toEqual([...locales].sort());
  });

  it.each(locales)('%s says every key the others do', locale => {
    const all = new Set(locales.flatMap(l => Object.keys(DICTS[l])));
    const missing = [...all].filter(key => !(key in DICTS[locale])).sort();
    expect(missing).toEqual([]);
  });

  it.each(locales)('%s leaves no string blank', locale => {
    const blank = Object.entries(DICTS[locale])
      .filter(([, word]) => word.trim() === '')
      .map(([key]) => key);
    expect(blank).toEqual([]);
  });

  // A word that is the same in every language is usually a copy-paste of the
  // English into the other two rather than a genuine cognate. The document
  // types have real ones — `Etibarnamə`/`Доверенность`/`Power of attorney`
  // differ, but numbers, brand and format strings legitimately do not — so this
  // only guards the keys this task filled in, where a duplicate means an
  // untranslated row.
  it('translates every document type into all three languages', () => {
    const untranslated = Object.keys(DICTS.en)
      .filter(key => key.startsWith('doctype.'))
      .filter(key => DICTS.ru[key] === DICTS.en[key]);
    expect(untranslated).toEqual([]);
  });
});

/**
 * The catalogue is a list that grows on the server. A key the engine has
 * learned and this dictionary has not must reach the inspector as the key, not
 * as a gap in the table — the register would otherwise draw an untitled row for
 * a document that read perfectly well.
 */
describe('a key no dictionary has a word for', () => {
  const t = (key: string) => DICTS.ru[key] ?? key;

  it('falls back to the key rather than to nothing', () => {
    expect(
      translateOr(t, 'doctype.future_catalogue_key', 'future_catalogue_key'),
    ).toBe('future_catalogue_key');
  });

  it('still answers with the word where there is one', () => {
    expect(translateOr(t, 'doctype.out_of_profile', 'out_of_profile')).toBe(
      'Прочие документы',
    );
  });
});
