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

  it('agrees about nothing when one side says nothing', () => {
    expect(looksLikeTheSameValue('', 'Əliyev')).toBe(false);
  });
});
