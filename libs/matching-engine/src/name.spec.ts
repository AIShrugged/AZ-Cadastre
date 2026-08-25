import { describe, expect, it } from 'vitest';

import { namesAgree } from './name.js';

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
