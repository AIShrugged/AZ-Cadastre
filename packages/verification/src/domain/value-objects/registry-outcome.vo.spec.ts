import { describe, expect, it } from 'vitest';

import { InvalidRegistryOutcomeException } from '../exceptions/index.js';

import { RegistryOutcome } from './registry-outcome.vo.js';

describe('RegistryOutcome', () => {
  it('reads back the five answers the stage can record', () => {
    expect(RegistryOutcome.all.map(outcome => outcome.value)).toEqual([
      'Confirmed',
      'Differs',
      'Incomplete',
      'NotFound',
      'Ambiguous',
    ]);
  });

  /*
   * Two findings against the package and not one, which is the whole reason
   * `Incomplete` exists: a record that says something else and a file the
   * original is not in are different problems with different answers, and an
   * inspector told only that "the register did not confirm it" cannot tell
   * which they are looking at (ADR-0010).
   */
  it('separates a record that contradicts from a file that is short a paper', () => {
    expect(RegistryOutcome.DIFFERS.contradicts).toBe(true);
    expect(RegistryOutcome.DIFFERS.isShortOfPaper).toBe(false);
    expect(RegistryOutcome.INCOMPLETE.isShortOfPaper).toBe(true);
    expect(RegistryOutcome.INCOMPLETE.contradicts).toBe(false);
  });

  it('sends a file that is short a paper to the inspector', () => {
    expect(RegistryOutcome.INCOMPLETE.needsInspector).toBe(true);
    expect(RegistryOutcome.INCOMPLETE.confirms).toBe(false);
  });

  it('refuses a word that is not one of them', () => {
    expect(() => RegistryOutcome.of('Valid')).toThrow(
      InvalidRegistryOutcomeException,
    );
  });

  // The distinction the whole stage turns on: only a record that says something
  // else is a fault. An absent record is the register's coverage, not the
  // package's shortfall.
  it('contradicts the package only when a record was found and disagrees', () => {
    expect(RegistryOutcome.DIFFERS.contradicts).toBe(true);
    expect(RegistryOutcome.NOT_FOUND.contradicts).toBe(false);
    expect(RegistryOutcome.AMBIGUOUS.contradicts).toBe(false);
    expect(RegistryOutcome.CONFIRMED.contradicts).toBe(false);
  });

  it('reaches the inspector for anything but a confirmation', () => {
    expect(RegistryOutcome.CONFIRMED.needsInspector).toBe(false);
    expect(RegistryOutcome.NOT_FOUND.needsInspector).toBe(true);
    expect(RegistryOutcome.AMBIGUOUS.needsInspector).toBe(true);
    expect(RegistryOutcome.DIFFERS.needsInspector).toBe(true);
  });

  /*
   * A profile may put more than one question to the register, and a row of the
   * list has one word to say them in. Which word is a judgement about what the
   * inspector has to do, so it is made here rather than by whichever screen
   * happens to be drawing a row.
   */
  describe('the one answer a row can carry', () => {
    it('says nothing at all about a package the register was never asked about', () => {
      expect(RegistryOutcome.overall([])).toBeNull();
    });

    it('carries the answer through unchanged when only one question was put', () => {
      expect(RegistryOutcome.overall([RegistryOutcome.NOT_FOUND])).toBe(
        RegistryOutcome.NOT_FOUND,
      );
    });

    // A record that says something else is the one answer that is a fault in
    // the submission, so it is the one that reaches the row.
    it('answers with the contradiction over everything else', () => {
      expect(
        RegistryOutcome.overall([
          RegistryOutcome.CONFIRMED,
          RegistryOutcome.NOT_FOUND,
          RegistryOutcome.DIFFERS,
          RegistryOutcome.INCOMPLETE,
        ]),
      ).toBe(RegistryOutcome.DIFFERS);
    });

    // The second finding against the package, and it outranks the two answers
    // that are about the register's coverage rather than about the papers.
    it('answers with a file short of a paper over an unresolved or absent record', () => {
      expect(
        RegistryOutcome.overall([
          RegistryOutcome.CONFIRMED,
          RegistryOutcome.AMBIGUOUS,
          RegistryOutcome.INCOMPLETE,
        ]),
      ).toBe(RegistryOutcome.INCOMPLETE);
    });

    it('answers with a property more than one record claims over no record at all', () => {
      expect(
        RegistryOutcome.overall([
          RegistryOutcome.NOT_FOUND,
          RegistryOutcome.AMBIGUOUS,
        ]),
      ).toBe(RegistryOutcome.AMBIGUOUS);
    });

    // The one answer that asks nothing of anybody, so a row may only say it
    // when every question was answered that way.
    it('confirms only when every question was confirmed', () => {
      expect(
        RegistryOutcome.overall([
          RegistryOutcome.CONFIRMED,
          RegistryOutcome.CONFIRMED,
        ]),
      ).toBe(RegistryOutcome.CONFIRMED);
      expect(
        RegistryOutcome.overall([
          RegistryOutcome.CONFIRMED,
          RegistryOutcome.NOT_FOUND,
        ]),
      ).toBe(RegistryOutcome.NOT_FOUND);
    });

    // Whatever the register can answer, the row can carry: an outcome added to
    // the enumeration and left out of the ordering would come back as null on a
    // package the register plainly answered.
    it('has an answer for every outcome the register can give', () => {
      for (const outcome of RegistryOutcome.all) {
        expect(RegistryOutcome.overall([outcome])).toBe(outcome);
      }
    });
  });
});
