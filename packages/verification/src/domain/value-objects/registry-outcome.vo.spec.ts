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
});
