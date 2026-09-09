import { InvalidDeclaredYearException } from '../exceptions/index.js';
import {
  EARLIEST_YEAR,
  LATEST_YEAR,
} from '../services/building-measures.service.js';

import type { DocumentType } from './document-type.vo.js';

/**
 * What the office declared about a submission when it took it in: the ground
 * the claimed right rests on, and the year the building is said to have been
 * built.
 *
 * A second source of facts about the case, and deliberately not merged with the
 * first. Everything else this system holds about a package was read off the
 * papers by the engine and carries a confidence, because a reading can be a bad
 * one; these two were typed by a person at a counter, carry no confidence, and
 * are evidence of nothing except what was said. The branch that decides which
 * supporting documents a case needs falls back to the declared year where no
 * paper states one — and where both exist and disagree, the report says so
 * rather than choosing between them.
 *
 * Either may be absent, and both usually are on a package taken in before the
 * intake screen asked: a declaration is not a requirement, and nothing refuses
 * a submission for want of one.
 */
export class DeclaredAtIntake {
  private constructor(
    public readonly legalBasis: DocumentType | null,
    public readonly builtYear: number | null,
  ) {}

  // A submission nobody declared anything about. Not an absence to be filled in
  // later: it is what every package taken in before intake asked is, and what
  // a caller that sends no declaration means.
  static none(): DeclaredAtIntake {
    return new DeclaredAtIntake(null, null);
  }

  static of(state: {
    legalBasis?: DocumentType | null;
    builtYear?: number | null;
  }): DeclaredAtIntake {
    const year = state.builtYear ?? null;

    if (year !== null) DeclaredAtIntake.guardYear(year);

    return new DeclaredAtIntake(state.legalBasis ?? null, year);
  }

  // Held to the same window a year read off a paper is: the two are compared,
  // and a declared figure the engine could never read off a sheet would make
  // every comparison against it a disagreement about the window.
  private static guardYear(year: number): void {
    if (!Number.isInteger(year) || year < EARLIEST_YEAR || year > LATEST_YEAR) {
      throw new InvalidDeclaredYearException(year);
    }
  }

  get statesAnything(): boolean {
    return this.legalBasis !== null || this.builtYear !== null;
  }
}
