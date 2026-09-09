import { describe, expect, it } from 'vitest';

import { nameConfidence, namesAgree } from './name.js';

describe('namesAgree', () => {
  // The example the profile itself gives for what agreement means.
  it('forgives the case ending an application form puts on a name', () => {
    expect(
      namesAgree('Əliyeva Rübabə Kavı qızına', 'Əliyeva Rübabə Kavı qızı'),
    ).toBe(true);
  });

  it('forgives a patronymic one document carries and the other omits', () => {
    expect(namesAgree('Əliyeva Rübabə', 'Əliyeva Rübabə Kavı qızı')).toBe(true);
  });

  it('forgives word order and the script', () => {
    expect(namesAgree('Rübabə Əliyeva', 'Ялийева Рцбабя')).toBe(true);
  });

  // The same bug, where it was actually met: the papers print a name in
  // capitals and the register holds it in ordinary case.
  it('forgives a name printed in capitals against one in ordinary case', () => {
    expect(namesAgree('ELÇİN ƏLİYEV', 'Əliyev Elçin Vaqif oğlu')).toBe(true);
  });

  it('does not forgive a different surname', () => {
    expect(namesAgree('Əliyeva Rübabə', 'Həsənova Rübabə')).toBe(false);
  });

  it('does not identify anybody by one word', () => {
    expect(namesAgree('Rübabə', 'Əliyeva Rübabə Kavı qızı')).toBe(false);
  });
});

/*
 * The graded form of the same rule, for the search that offers records rather
 * than resolving to one. Every pair `namesAgree` accepts is 1 here — the two
 * cannot disagree about a name, or the search would offer what the lookup
 * refuses to act on (ADR-0009).
 */
describe('nameConfidence', () => {
  it('is certain about a pair the rule itself accepts', () => {
    expect(
      nameConfidence('Əliyeva Rübabə Kavı qızına', 'Əliyeva Rübabə Kavı qızı'),
    ).toBe(1);
    expect(nameConfidence('ELÇİN ƏLİYEV', 'Əliyev Elçin Vaqif oğlu')).toBe(1);
  });

  // A name typed out of the Cyrillic code page by hand, which is how half of
  // what an operator types arrives.
  it('grades a name transliterated by hand as very nearly the same name', () => {
    expect(
      nameConfidence('Aliyeva Rubaba', 'Əliyeva Rübabə Kavı qızı'),
    ).toBeGreaterThan(0.85);
  });

  /*
   * A surname on its own. The lookup refuses it — half the district shares one
   * — and the search answers it as the weak evidence it is rather than
   * refusing, because a search offers and does not act.
   */
  it('answers a surname typed on its own, and weakly', () => {
    const alone = nameConfidence('Əliyeva', 'Əliyeva Rübabə Kavı qızı');

    expect(alone).toBeGreaterThan(0);
    expect(alone).toBeLessThanOrEqual(0.5);
  });

  /*
   * Two people who share nothing but the patronymic marker every Azerbaijani
   * name ends in. Without a floor under the word comparison, `qızı` against
   * `qızı` and a shared vowel would read as half a match.
   */
  it('is not fooled by the words every name carries', () => {
    expect(
      nameConfidence('Həsənova Sevinc Əli qızı', 'Əliyeva Rübabə Kavı qızı'),
    ).toBeLessThan(0.5);
  });

  it('has nothing to say about a name that is not there', () => {
    expect(nameConfidence('', 'Əliyeva Rübabə Kavı qızı')).toBe(0);
  });
});
