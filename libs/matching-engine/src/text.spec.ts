import { describe, expect, it } from 'vitest';

import {
  digitsOf,
  fold,
  fromLegacyCyrillic,
  isCyrillic,
  stripInitials,
  tokenise,
} from './text.js';

describe('fromLegacyCyrillic', () => {
  // The archive's own sheets: "Гейри йашайыш сащяси" is qeyri-yaşayış sahəsi,
  // not anything a Russian table would produce.
  it('reads the archive legacy code page as Azerbaijani, not as Russian', () => {
    expect(fromLegacyCyrillic('гейри йашайыш сащяси')).toBe(
      'qeyri yaşayış sahəsi',
    );
  });

  it('reads a district name the sheets spell in Cyrillic', () => {
    expect(fromLegacyCyrillic('няриманов району')).toBe('nərimanov rayonu');
  });

  it('reads a city name the sheets spell in Cyrillic', () => {
    expect(fromLegacyCyrillic('эянъя')).toBe('gəncə');
  });
});

describe('isCyrillic', () => {
  it('sees Cyrillic', () => {
    expect(isCyrillic('Зыг')).toBe(true);
  });

  it('does not see it in Latin Azerbaijani', () => {
    expect(isCyrillic('Zığ qəsəbəsi')).toBe(false);
  });
});

describe('fold', () => {
  it('folds the diacritics a keyboard without an Azerbaijani layout loses', () => {
    expect(fold('Şəhəri')).toBe('seheri');
    expect(fold('Zığ')).toBe('zig');
  });

  it('brings a Cyrillic spelling onto the same skeleton as its Latin one', () => {
    expect(fold('Няриманов')).toBe(fold('Nərimanov'));
  });

  /*
   * Guards the bug the first call against the register found: "İ" lowercases to
   * "i" plus a combining dot above, so a name printed in capitals — which is how
   * every identity document prints one — matched nothing.
   */
  it('folds the dotted capital I onto the same letter as its lower case', () => {
    expect(fold('ELÇİN')).toBe(fold('Elçin'));
    expect(fold('ƏLİYEV')).toBe(fold('Əliyev'));
  });
});

describe('tokenise', () => {
  it('ends a word on a full stop that is followed by one', () => {
    expect(tokenise('H.Əliyev küç. 12')).toEqual(['H.Əliyev', 'küç', '12']);
  });

  it('splits on commas and collapses the spaces around them', () => {
    expect(tokenise('Bakı,  Zığ qəs.')).toEqual(['Bakı', 'Zığ', 'qəs']);
  });
});

describe('stripInitials', () => {
  it('drops an initial written against the name', () => {
    expect(stripInitials('H.Əliyev')).toBe('Əliyev');
  });

  it('drops an initial written apart from it', () => {
    expect(stripInitials('H. Əliyev')).toBe('Əliyev');
  });

  // Otherwise a one-word street would strip down to nothing and match anything.
  it('leaves a name that is only one word alone', () => {
    expect(stripInitials('Zirə')).toBe('Zirə');
  });
});

describe('digitsOf', () => {
  it('keeps the digits and drops what separates them', () => {
    expect(digitsOf('AZE 12-34 567')).toBe('1234567');
  });
});
