import { describe, expect, it } from 'vitest';

import type {
  ProfileDto,
  ProfileSuggestionDto,
} from '@cadastre/api-contracts/verification';

import { suggestionLines } from './profile-suggestion';

// The dictionary is not under test here: `t` answers with the key and the
// params it was given, so a line is asserted by which sentence was chosen and
// what was put in it — not by the words of any one language.
const t = (key: string, params?: Record<string, string | number>) =>
  params === undefined
    ? key
    : `${key}(${Object.entries(params)
        .map(([name, value]) => `${name}=${value}`)
        .join(',')})`;

const profile = (key: string, grounds: string[]): ProfileDto => ({
  key,
  documentTypes: grounds.map(ground => ({
    key: ground,
    required: true,
    fields: [],
  })),
  grounds,
});

const cadastre = profile('cadastre', ['disposal_order']);
const restitution = profile('restitution', ['disposal_order', 'court_ruling']);

const answer = (profileKey: string | null): ProfileSuggestionDto => ({
  profileKey,
  // The English audit line the engine writes for the record. Nothing on the
  // screen reads it, which is the whole reason `criterion` is published.
  reasons: [
    { criterion: 'legalBasis', note: 'an English audit line' },
    { criterion: 'builtYear', note: 'another English audit line' },
  ],
});

const lines = (
  suggestion: ProfileSuggestionDto,
  declared: { legalBasis: string | null; builtYear: number | null },
  profiles: ProfileDto[],
) =>
  Object.fromEntries(
    suggestionLines(t, suggestion, declared, profiles).map(line => [
      line.criterion,
      line.text,
    ]),
  );

describe('suggestionLines', () => {
  it('states one line per criterion, in the order the engine stated them', () => {
    expect(
      suggestionLines(
        t,
        answer('cadastre'),
        { legalBasis: 'disposal_order', builtYear: null },
        [cadastre],
      ).map(line => line.criterion),
    ).toEqual(['legalBasis', 'builtYear']);
  });

  it('never prints the English audit line', () => {
    const said = suggestionLines(
      t,
      answer('cadastre'),
      { legalBasis: 'disposal_order', builtYear: 1998 },
      [cadastre],
    ).map(line => line.text);

    expect(said.join(' ')).not.toContain('English audit line');
  });

  it('explains a declaration that names no ground', () => {
    expect(
      lines(answer(null), { legalBasis: null, builtYear: null }, [cadastre]),
    ).toEqual({
      legalBasis: 'suggest.basis.none',
      builtYear: 'suggest.year.moot',
    });
  });

  it('explains a ground no profile registers a right on', () => {
    expect(
      lines(answer(null), { legalBasis: 'sale_contract', builtYear: 1998 }, [
        cadastre,
      ]),
    ).toEqual({
      legalBasis: 'suggest.basis.unregistered(ground=sale_contract)',
      builtYear: 'suggest.year.moot',
    });
  });

  it('explains a ground more than one profile registers a right on', () => {
    expect(
      lines(answer(null), { legalBasis: 'disposal_order', builtYear: null }, [
        cadastre,
        restitution,
      ]),
    ).toEqual({
      legalBasis:
        'suggest.basis.several(ground=disposal_order,profiles=cadastre, restitution)',
      builtYear: 'suggest.year.undeclared',
    });
  });

  it('names the profile a ground selects, and what the year left standing', () => {
    expect(
      lines(
        answer('cadastre'),
        { legalBasis: 'disposal_order', builtYear: 1998 },
        [cadastre],
      ),
    ).toEqual({
      legalBasis: 'suggest.basis.only(ground=disposal_order,profile=cadastre)',
      builtYear: 'suggest.year.leaves(year=1998,profile=cadastre)',
    });
  });

  it('says a year was not needed where the suggestion stands without one', () => {
    expect(
      lines(
        answer('cadastre'),
        { legalBasis: 'disposal_order', builtYear: null },
        [cadastre],
      ),
    ).toEqual({
      legalBasis: 'suggest.basis.only(ground=disposal_order,profile=cadastre)',
      builtYear: 'suggest.year.any(profile=cadastre)',
    });
  });

  it('says the single candidate is waiting on a year nobody declared', () => {
    // One profile registers the ground and the engine still suggests none with
    // no year declared: the profile answers for a period, and the year is
    // precisely what it cannot be ruled in or out without.
    expect(
      lines(answer(null), { legalBasis: 'disposal_order', builtYear: null }, [
        cadastre,
      ]),
    ).toEqual({
      legalBasis: 'suggest.basis.only(ground=disposal_order,profile=cadastre)',
      builtYear: 'suggest.year.awaited(profile=cadastre)',
    });
  });

  it('says a year ruled the single candidate out', () => {
    expect(
      lines(answer(null), { legalBasis: 'disposal_order', builtYear: 1750 }, [
        cadastre,
      ]),
    ).toEqual({
      legalBasis: 'suggest.basis.only(ground=disposal_order,profile=cadastre)',
      builtYear: 'suggest.year.rules_out(year=1750,profile=cadastre)',
    });
  });

  it('says only that a year did not narrow to one where several were in play', () => {
    // Whether it excluded all of them or left several standing is not something
    // the published contract says — the periods a profile answers for are not
    // in it — so the line states what is certain and invents no bound.
    expect(
      lines(answer(null), { legalBasis: 'disposal_order', builtYear: 1998 }, [
        cadastre,
        restitution,
      ]),
    ).toEqual({
      legalBasis:
        'suggest.basis.several(ground=disposal_order,profiles=cadastre, restitution)',
      builtYear: 'suggest.year.no_narrower(year=1998)',
    });
  });
});
