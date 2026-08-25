import { describe, expect, it } from 'vitest';

import { InvalidRegistryOutcomeException } from '../exceptions/index.js';

import { RegistryOutcome } from './registry-outcome.vo.js';

describe('RegistryOutcome', () => {
  it('reads back the four answers a register can give', () => {
    expect(RegistryOutcome.all.map(outcome => outcome.value)).toEqual([
      'Confirmed',
      'Differs',
      'NotFound',
      'Ambiguous',
    ]);
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
