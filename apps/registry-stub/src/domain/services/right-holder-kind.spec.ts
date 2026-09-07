import { describe, expect, it } from 'vitest';

import { kindOfHolder } from './right-holder-kind.js';

describe('telling a person from a firm in the right-holder column', () => {
  it.each([
    'Əliyeva Rübabə Kavı qızı',
    'Rəsulov Elşən Həsən oğlu',
    'Şabanov Məmməd Çoban',
    'Язизов Ариф Мювлуд оьлу',
  ])('reads %s as a person', name => {
    expect(kindOfHolder(name)).toBe('Individual');
  });

  it.each([
    '"Qərənfil 97" firması',
    'SEYRAN MMC',
    '"Buxar" kollektiv müəsisəsi',
    'Elm və təhsil mərkəzi "Təfəkkür" Universiteti',
    'Binəqədi rayon MKTB',
  ])('reads %s as a firm', name => {
    expect(kindOfHolder(name)).toBe('LegalEntity');
  });

  /*
   * The patronymic settles it. `Məmmədov Kənan Əli oğlu (Dövlət)` carries the
   * word for a state body and is a person's name; a rule that read the
   * organisation word first would hide the record behind the wrong kind.
   */
  it('reads a patronymic as a person even beside an organisation word', () => {
    expect(kindOfHolder('Məmmədov Kənan Əli oğlu (Dövlət İdarəsi)')).toBe(
      'Individual',
    );
  });

  /*
   * These registers are overwhelmingly people, and the two mistakes do not cost
   * the same: being told a firm is a person costs an inspector one glance, and
   * being told a person is a firm costs them the record.
   */
  it('reads a name that says neither as a person', () => {
    expect(kindOfHolder('Həsənova Fatma')).toBe('Individual');
  });
});
