import { describe, expect, it } from 'vitest';

import {
  PackageStanding,
  type PackageStandingFacts,
} from './package-standing.vo.js';
import { PackageStatus } from './package-status.vo.js';
import { ReportStatus } from './report-status.vo.js';

// A package the register was never asked about, which is the plain case: a
// profile that declares no registry check, and a package whose address no sheet
// stated, both arrive here.
function facts(overrides: Partial<PackageStandingFacts> = {}) {
  return {
    status: PackageStatus.COMPLETED,
    report: ReportStatus.OK,
    askedTheArchive: false,
    archiveSearchApproved: false,
    ...overrides,
  };
}

function standingOf(overrides: Partial<PackageStandingFacts> = {}): string {
  return PackageStanding.of(facts(overrides)).value;
}

describe('PackageStanding', () => {
  describe('while the engine still has it', () => {
    it('waits to be picked up when nothing has read it yet', () => {
      expect(standingOf({ status: PackageStatus.PENDING, report: null })).toBe(
        'Queued',
      );
    });

    it('says a run is reading it', () => {
      expect(
        standingOf({ status: PackageStatus.PROCESSING, report: null }),
      ).toBe('UnderVerification');
    });

    /*
     * A run that broke down concluded nothing about the papers, which is what
     * separates this from every standing below: the rest are the engine having
     * something to say, this is the engine having failed to say anything. An
     * inspector told "no issues" because our provider timed out would be told a
     * falsehood about somebody's submission.
     */
    it('says our own machinery broke down, not that the package is in order', () => {
      expect(standingOf({ status: PackageStatus.FAILED, report: null })).toBe(
        'Stalled',
      );
    });

    // `complete()` compiles a report before it finishes, so there is no honest
    // way to be here — and a package that got here anyway is a breakdown, not a
    // clean submission.
    it('says the same of a finished run that left nothing to read', () => {
      expect(
        standingOf({ status: PackageStatus.COMPLETED, report: null }),
      ).toBe('Stalled');
    });

    // The report a failed run was compiled from described an envelope this
    // package has since been re-opened from; the breakdown is the current news.
    it('reports the breakdown over whatever an earlier report said', () => {
      expect(
        standingOf({
          status: PackageStatus.FAILED,
          report: ReportStatus.OK,
          askedTheArchive: true,
        }),
      ).toBe('Stalled');
    });
  });

  describe('once a run has finished', () => {
    it('says a required paper never arrived', () => {
      expect(standingOf({ report: ReportStatus.INCOMPLETE_PACKAGE })).toBe(
        'ShortOfDocuments',
      );
    });

    it('says a person has findings to resolve', () => {
      expect(standingOf({ report: ReportStatus.ISSUES_FOUND })).toBe(
        'NeedsInspector',
      );
    });

    it('clears a package nothing is held against and nothing was asked about', () => {
      expect(standingOf({ report: ReportStatus.OK })).toBe('Cleared');
    });
  });

  describe('and the archive search it rests on', () => {
    it('waits for a person to approve what the register answered', () => {
      expect(standingOf({ askedTheArchive: true })).toBe(
        'AwaitingArchiveApproval',
      );
    });

    it('clears the package once somebody has approved it', () => {
      expect(
        standingOf({ askedTheArchive: true, archiveSearchApproved: true }),
      ).toBe('Cleared');
    });

    // A profile that asks the register nothing, and a package whose address no
    // sheet stated, leave no search for anybody to sign: holding a submission
    // for the approval of a question that was never put would strand it.
    it('waits for nobody when the register was never asked', () => {
      expect(standingOf({ askedTheArchive: false })).toBe('Cleared');
    });
  });

  /*
   * Ordered by what has to happen next, most pressing first. The paper will be
   * added, the run will happen again, and everything the register answered
   * about the old envelope is discarded with the report (ADR-0013) — so naming
   * the archive approval now would send a person to do work that is about to be
   * thrown away.
   */
  describe('when more than one thing is outstanding', () => {
    it('names the missing paper ahead of the findings it caused', () => {
      expect(
        standingOf({
          report: ReportStatus.INCOMPLETE_PACKAGE,
          askedTheArchive: true,
        }),
      ).toBe('ShortOfDocuments');
    });

    it('names the findings ahead of an archive search waiting to be approved', () => {
      expect(
        standingOf({
          report: ReportStatus.ISSUES_FOUND,
          askedTheArchive: true,
        }),
      ).toBe('NeedsInspector');
    });
  });

  /*
   * The list screen narrows by standing, and nothing stores one: the register
   * has to turn a standing back into a condition over the three columns it is
   * derived from. That inverse is filtered out of `of()` rather than written
   * beside it, and these hold it to being exactly that — a second derivation
   * that drifted would show the inspector a row under a standing its own card
   * denies (ADR-0014, ADR-0015).
   */
  describe('read backwards, from a standing to the facts that produce it', () => {
    // The whole fact space, which is what makes the two assertions below a
    // proof rather than a sample.
    const everyFact: readonly PackageStandingFacts[] =
      PackageStatus.all.flatMap(status =>
        [null, ...ReportStatus.all].flatMap(report =>
          [false, true].flatMap(askedTheArchive =>
            [false, true].map(archiveSearchApproved => ({
              status,
              report,
              askedTheArchive,
              archiveSearchApproved,
            })),
          ),
        ),
      );

    it('names only facts that do produce it', () => {
      for (const standing of PackageStanding.all) {
        for (const candidate of standing.facts) {
          expect(PackageStanding.of(candidate).value).toBe(standing.value);
        }
      }
    });

    // The half that a filter would fail quietly on: a standing that left a
    // fact out would answer with a page missing the rows the inspector opened
    // the screen for, and nothing would say so.
    it('leaves out no fact that produces it', () => {
      for (const candidate of everyFact) {
        const standing = PackageStanding.of(candidate);

        expect(standing.facts).toContainEqual(candidate);
      }
    });

    it('splits the whole fact space between the standings, once each', () => {
      const named = PackageStanding.all.flatMap(standing => [
        ...standing.facts,
      ]);

      expect(named).toHaveLength(everyFact.length);
    });
  });

  it('arrives at every standing it names and no others', () => {
    const reached = new Set(
      [
        standingOf({ status: PackageStatus.PENDING, report: null }),
        standingOf({ status: PackageStatus.PROCESSING, report: null }),
        standingOf({ status: PackageStatus.FAILED, report: null }),
        standingOf({ report: ReportStatus.INCOMPLETE_PACKAGE }),
        standingOf({ report: ReportStatus.ISSUES_FOUND }),
        standingOf({ askedTheArchive: true }),
        standingOf({ report: ReportStatus.OK }),
      ].sort(),
    );

    expect([...reached]).toEqual(
      PackageStanding.all.map(standing => standing.value).sort(),
    );
  });
});
