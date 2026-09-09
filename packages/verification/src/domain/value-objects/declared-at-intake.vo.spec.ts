import { describe, expect, it } from 'vitest';

import { InvalidDeclaredYearException } from '../exceptions/index.js';

import { DeclaredAtIntake } from './declared-at-intake.vo.js';
import { DocumentType } from './document-type.vo.js';

describe('DeclaredAtIntake', () => {
  it('holds the ground and the year the office declared', () => {
    const declared = DeclaredAtIntake.of({
      legalBasis: DocumentType.create('disposal_order'),
      builtYear: 1998,
    });

    expect(declared.legalBasis?.value).toBe('disposal_order');
    expect(declared.builtYear).toBe(1998);
  });

  // The ordinary submission, and every one taken in before intake asked.
  it('is nothing where the office declared nothing', () => {
    const declared = DeclaredAtIntake.none();

    expect(declared.legalBasis).toBeNull();
    expect(declared.builtYear).toBeNull();
    expect(declared.statesAnything).toBe(false);
  });

  it('takes either figure on its own', () => {
    expect(DeclaredAtIntake.of({ builtYear: 2005 }).statesAnything).toBe(true);
    expect(
      DeclaredAtIntake.of({ legalBasis: DocumentType.create('disposal_order') })
        .statesAnything,
    ).toBe(true);
  });

  /*
   * Held to the same window a year read off a paper is. The two are compared,
   * and a declared figure the engine could never read off a sheet would make
   * every comparison against it a disagreement about the window rather than
   * about the case.
   */
  it('refuses a year no paper of these could be dated by', () => {
    expect(() => DeclaredAtIntake.of({ builtYear: 1799 })).toThrow(
      InvalidDeclaredYearException,
    );
    expect(() => DeclaredAtIntake.of({ builtYear: 2201 })).toThrow(
      InvalidDeclaredYearException,
    );
  });

  it('takes the years at either end of that window', () => {
    expect(DeclaredAtIntake.of({ builtYear: 1800 }).builtYear).toBe(1800);
    expect(DeclaredAtIntake.of({ builtYear: 2200 }).builtYear).toBe(2200);
  });

  // A year is a year and not a measurement: half of one is somebody's mistake,
  // and taking it would put a case in a band on a figure nobody stated.
  it('refuses a year that is not a whole one', () => {
    expect(() => DeclaredAtIntake.of({ builtYear: 2005.5 })).toThrow(
      InvalidDeclaredYearException,
    );
  });

  it('says nothing about which profile the ground belongs to, which is the profile’s own rule', () => {
    expect(() =>
      DeclaredAtIntake.of({
        legalBasis: DocumentType.create('a_paper_no_profile_registers'),
      }),
    ).not.toThrow();
  });
});
