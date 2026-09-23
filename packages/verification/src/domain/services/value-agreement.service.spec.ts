import { describe, expect, it } from 'vitest';

import { looksLikeTheSameValue, tokensOf } from './value-agreement.service.js';

describe('tokensOf', () => {
  it('folds the diacritics a scan drops', () => {
    expect(tokensOf('Əliyeva Rübabə')).toEqual(['eliyeva', 'rubabe']);
  });

  it('cuts on anything that is not a letter or a digit', () => {
    expect(tokensOf('Bakı ş., Nizami küç., ev 14/2')).toEqual([
      'baki',
      's',
      'nizami',
      'kuc',
      'ev',
      '14',
      '2',
    ]);
  });
});

describe('looksLikeTheSameValue', () => {
  it('reads a name through the case ending a form attached to it', () => {
    expect(
      looksLikeTheSameValue('Əliyeva Rübabə', 'Əliyeva Rübabə Kavı qızına'),
    ).toBe(true);
  });

  it('reads a surname the same whether the paper printed it in capitals', () => {
    expect(looksLikeTheSameValue('ƏLİYEV Elçin', 'Əliyev Elçin')).toBe(true);
  });

  it('does not read one surname as another', () => {
    expect(looksLikeTheSameValue('Əliyev Elçin', 'Məmmədov Elçin')).toBe(false);
  });

  it('lets the fuller document say more than the shorter one', () => {
    expect(
      looksLikeTheSameValue(
        'Bakı, Nizami küç. 14',
        'Bakı şəhəri, Nizami küçəsi, ev 14',
      ),
    ).toBe(true);
  });

  it('takes a document number apart from how it was spaced', () => {
    expect(looksLikeTheSameValue('AZE 12345678', 'AZE12345678')).toBe(true);
  });

  it('takes a different digit as a different document', () => {
    expect(looksLikeTheSameValue('AZE 12345678', 'AZE 12345679')).toBe(false);
  });

  it('reads a word the other document carried on as the same word', () => {
    expect(looksLikeTheSameValue('Sumqayıt', 'Sumqayıtçay')).toBe(true);
  });

  it('does not read one word as another that merely begins alike', () => {
    expect(looksLikeTheSameValue('Gəncə', 'Göyçay')).toBe(false);
    expect(looksLikeTheSameValue('Elçin', 'Elçibəy')).toBe(false);
  });

  /*
   * The one letter an ASCII keyboard has two answers for (COMM-153).
   *
   * The archive's copy of the Hümbətov order prints "Hümbətov Yavər Kərim
   * oğlu" and the package's own sheet was read as "Hümbətov Yaver Karim oğlu"
   * — one `ə` heard as `e`, the next transliterated as `a`, in one name. Folded
   * to `e` alone, the comparison called the archive's own copy a contradiction
   * of the paper it is a copy of, which is the worst answer this check has.
   */
  it('reads the one letter an ascii keyboard spells two ways', () => {
    expect(
      looksLikeTheSameValue(
        'Hümbətov Yaver Karim oğlu',
        'Hümbətov Yavər Kərim oğlu',
      ),
    ).toBe(true);
    expect(looksLikeTheSameValue('Həsənov', 'Hasanov')).toBe(true);
  });

  /*
   * And only where that letter is. Reading every `e` as an `a` would make two
   * surnames one; the second reading belongs to the word that carries `ə` and
   * to no other.
   */
  it('does not read one surname as another that merely swaps a vowel', () => {
    expect(looksLikeTheSameValue('Balayev Elçin', 'Belayev Elçin')).toBe(false);
  });

  it('agrees about nothing when one side says nothing', () => {
    expect(looksLikeTheSameValue('', 'Əliyev')).toBe(false);
  });
});
