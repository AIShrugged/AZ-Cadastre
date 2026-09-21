import { describe, expect, it } from 'vitest';

import { InvalidPersonNameException } from '../exceptions/index.js';

import { PersonName } from './person-name.vo.js';

describe('PersonName', () => {
  it('keeps the two parts apart and tidies each', () => {
    const name = PersonName.create('  Rəşad ', 'Məmmədov  ');

    expect(name.first).toBe('Rəşad');
    expect(name.last).toBe('Məmmədov');
  });

  it('folds a run of whitespace inside a part to one space', () => {
    expect(PersonName.create('Ana   Maria', 'del  Rio').first).toBe(
      'Ana Maria',
    );
  });

  it.each([
    ['a first name that is blank', '   ', 'Məmmədov'],
    ['a last name that is blank', 'Rəşad', ''],
    ['a first name past the ceiling', 'a'.repeat(101), 'Məmmədov'],
    ['a last name past the ceiling', 'Rəşad', 'a'.repeat(101)],
  ])('refuses %s', (_case, first, last) => {
    expect(() => PersonName.create(first, last)).toThrow(
      InvalidPersonNameException,
    );
  });

  it('says which part it refused', () => {
    expect(() => PersonName.create('Rəşad', ' ')).toThrow(/last name/);
  });
});
