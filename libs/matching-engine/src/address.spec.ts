import { describe, expect, it } from 'vitest';

import {
  addressConfidence,
  addressesAgree,
  addressKey,
  normaliseAddress,
  parseAddress,
} from './address.js';

describe('parseAddress', () => {
  it('binds an Azerbaijani marker to the word before it', () => {
    const { parts } = parseAddress('Zığ qəsəbəsi');

    expect(parts.get('qəsəbəsi')).toBe('Zığ');
  });

  it('binds a Russian marker to the word after it', () => {
    const { parts } = parseAddress('ул. Ленина');

    expect(parts.get('küçəsi')).toBe('lenina');
  });

  it('reads the number after a street as the house on it', () => {
    const { parts } = parseAddress('H.Əliyev küç. 12');

    expect(parts.get('küçəsi')).toBe('H.Əliyev');
    expect(parts.get('ev')).toBe('12');
  });

  it('keeps an initial written apart with the name it belongs to', () => {
    const { parts, rest } = parseAddress('H. Əliyev küçəsi 12');

    expect(parts.get('küçəsi')).toBe('H Əliyev');
    expect(rest).toEqual([]);
  });

  it('keeps a word no marker claimed rather than dropping it', () => {
    const { rest } = parseAddress('Bakı, Zığ qəs.');

    expect(rest).toEqual(['Bakı']);
  });

  it('states each level once: a second value for a bound level is not a level', () => {
    const { parts, rest } = parseAddress('Zığ küç. 5, ev 12');

    expect(parts.get('ev')).toBe('5');
    expect(rest).toContain('12');
  });
});

describe('normaliseAddress', () => {
  it('spells every level in full and widest first', () => {
    expect(normaliseAddress('H.Əliyev küç. 12, Zığ qəs., Suraxanı r.')).toBe(
      'Suraxanı rayonu, Zığ qəsəbəsi, H.Əliyev küçəsi, ev 12',
    );
  });
});

describe('addressKey', () => {
  it('is the same string for two spellings of one place', () => {
    expect(addressKey('Suraxanı r., Zığ qəs., Əliyev küç. 12')).toBe(
      addressKey('Zığ qəsəbəsi, Əliyev küçəsi 12, Suraxanı rayonu'),
    );
  });
});

describe('addressesAgree', () => {
  it('forgives abbreviations, word order and the script', () => {
    expect(
      addressesAgree(
        'Suraxanı r., Zığ qəs., Əliyev küç. 12',
        'Зығ гясябяси, Ялийев кцчяси 12, Сурахани району',
      ),
    ).toBe(true);
  });

  it('forgives an administrative level one document omits', () => {
    expect(
      addressesAgree(
        'Zığ qəsəbəsi, Əliyev küçəsi 12',
        'Suraxanı rayonu, Zığ qəsəbəsi, Əliyev küçəsi 12',
      ),
    ).toBe(true);
  });

  it('forgives an initial one document prints and the other omits', () => {
    expect(
      addressesAgree('Zığ qəs., H.Əliyev küç. 12', 'Zığ qəs., Əliyev küç. 12'),
    ).toBe(true);
  });

  it('does not forgive a different house number', () => {
    expect(
      addressesAgree('Zığ qəs., Əliyev küç. 12', 'Zığ qəs., Əliyev küç. 21'),
    ).toBe(false);
  });

  it('does not forgive a different settlement', () => {
    expect(
      addressesAgree(
        'Zığ qəs., Əliyev küç. 12',
        'Buzovna qəs., Əliyev küç. 12',
      ),
    ).toBe(false);
  });

  // The one the sorted-token shortcut gets wrong, which is why levels are
  // bound to their markers rather than compared as a bag of words.
  it('does not confuse a house number with a street number', () => {
    expect(addressesAgree('Zığ küç. 5, ev 12', 'Zığ küç. 12, ev 5')).toBe(
      false,
    );
  });

  it('is not an agreement when the two strings share nothing', () => {
    expect(addressesAgree('', '')).toBe(false);
  });
});

/*
 * The graded form, for the search that offers records rather than resolving to
 * one. Every pair `addressesAgree` accepts is 1 here: a search that offered
 * what the lookup refuses to act on would be a second, looser copy of the rule
 * (ADR-0009).
 */
describe('addressConfidence', () => {
  it('is certain about a pair the rule itself accepts', () => {
    expect(
      addressConfidence(
        'Suraxanı r., Zığ qəs., H.Əliyev küç. 12',
        'Bakı şəhəri, Suraxanı rayonu, Zığ qəsəbəsi, H.Əliyev küçəsi, ev 12',
      ),
    ).toBe(1);
  });

  it('is certain across the scripts, as the rule is', () => {
    expect(
      addressConfidence(
        'Гусар шящяри, Щ.З.Таьыйев кцчяси',
        'Qusar şəhəri, H.Z.Tağıyev küçəsi',
      ),
    ).toBe(1);
  });

  // A street name typed without its diacritics, which is most of what an
  // operator types.
  it('grades a street spelled without its diacritics as nearly the same street', () => {
    expect(
      addressConfidence(
        'Zığ qəsəbəsi, Aliyev kucesi',
        'Bakı şəhəri, Suraxanı rayonu, Zığ qəsəbəsi, H.Əliyev küçəsi, ev 12',
      ),
    ).toBeGreaterThan(0.85);
  });

  /*
   * The same street, another house. Worth showing — the number is the easiest
   * thing on the form to get wrong, and the archive may hold the neighbour
   * under the same case — and never worth reading as the same place: 12 is not
   * a misspelling of 14.
   */
  it('never lets a different house number read as a probable match', () => {
    expect(
      addressConfidence(
        'Zığ qəsəbəsi, H.Əliyev küçəsi, ev 14',
        'Bakı şəhəri, Suraxanı rayonu, Zığ qəsəbəsi, H.Əliyev küçəsi, ev 12',
      ),
    ).toBeLessThanOrEqual(0.5);
  });

  it('says next to nothing about another street in another district', () => {
    expect(
      addressConfidence(
        'Bakı şəhəri, Nizami rayonu, Yeni küçə, ev 1',
        'Bakı şəhəri, Suraxanı rayonu, Zığ qəsəbəsi, H.Əliyev küçəsi, ev 12',
      ),
    ).toBeLessThan(0.3);
  });

  it('is not a weak match when the two strings share nothing', () => {
    expect(addressConfidence('', '')).toBe(0);
  });
});
