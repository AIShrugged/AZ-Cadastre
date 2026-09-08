import { PackageStatus } from './package-status.vo.js';
import { ReportStatus } from './report-status.vo.js';

/*
 * What a standing is worked out from. Every one of these is already held
 * somewhere — the pipeline writes the first, the run compiles the second, the
 * register stage leaves the third — so nothing here is a field somebody has to
 * remember to keep true (ADR-0014).
 */
export type PackageStandingFacts = {
  // Where the pipeline got to.
  readonly status: PackageStatus;
  // What the run found. Null until one has compiled a report.
  readonly report: ReportStatus | null;
  /*
   * Whether the archive register was asked about this package at all. A
   * profile that asks it nothing, and a package whose address no sheet stated,
   * leave no archive search for anybody to sign off — and a submission is not
   * held waiting on a search that was never made.
   */
  readonly askedTheArchive: boolean;
  /*
   * Whether a person has approved what the archive answered. Nothing can
   * approve one yet — the approval, its comment and its summary are COMM-40 —
   * so this is false wherever the register was asked, and the standing says the
   * submission is waiting on a person rather than that it is settled.
   */
  readonly archiveSearchApproved: boolean;
};

/**
 * Where a submission stands: what has to happen to it next.
 *
 * The third thing in this context that a reader may call a status, and the only
 * one written for the inspector. `PackageStatus` is where the pipeline got to
 * and `ReportStatus` is what the run found; neither answers the question the
 * inspector actually opens the list with, because `Completed` covers a package
 * with a full set of papers and a package with seven findings alike.
 *
 * Worked out from what the package already holds, never set: a state somebody
 * has to remember to advance is a state that is wrong by the second week
 * (ADR-0014). Nothing stores it, so there is no column to migrate and no row to
 * fall out of step with the package it describes.
 */
export class PackageStanding {
  // Accepted, and no run has read it yet. Also where a package lands when a
  // file is added to one that had been reported on: the report went with the
  // envelope it described, so the submission is waiting to be read again
  // (ADR-0013).
  static readonly QUEUED = new PackageStanding('Queued');
  static readonly UNDER_VERIFICATION = new PackageStanding('UnderVerification');
  // Our own machinery broke down. Nothing was concluded about the papers, which
  // is what makes this different from every standing below it — those are the
  // engine having something to say, this is the engine having failed to say
  // anything.
  static readonly STALLED = new PackageStanding('Stalled');
  // A paper the profile requires never arrived. The next move is to get it, and
  // since ADR-0013 it can be added to this very package.
  static readonly SHORT_OF_DOCUMENTS = new PackageStanding('ShortOfDocuments');
  // The envelope is complete and the run holds findings against it — papers
  // that disagree, a record that contradicts them, a mark an office should have
  // pressed, a reading nobody could trust. Every one of them is for a person to
  // resolve; the engine never refuses a package.
  static readonly NEEDS_INSPECTOR = new PackageStanding('NeedsInspector');
  // Nothing is held against the package, and the archive search it rests on has
  // not been approved by anybody. The engine is done; a person still has to
  // sign for what the register answered (COMM-40).
  static readonly AWAITING_ARCHIVE_APPROVAL = new PackageStanding(
    'AwaitingArchiveApproval',
  );
  // Nothing is held against it and nothing is outstanding. Not a decision about
  // the registration — that is the inspector's and this system never makes it —
  // but the statement that this submission is not waiting on anyone.
  static readonly CLEARED = new PackageStanding('Cleared');

  private constructor(public readonly value: string) {}

  static get all(): readonly PackageStanding[] {
    return [
      PackageStanding.QUEUED,
      PackageStanding.UNDER_VERIFICATION,
      PackageStanding.STALLED,
      PackageStanding.SHORT_OF_DOCUMENTS,
      PackageStanding.NEEDS_INSPECTOR,
      PackageStanding.AWAITING_ARCHIVE_APPROVAL,
      PackageStanding.CLEARED,
    ];
  }

  /*
   * The one derivation, so the aggregate and the read surface cannot drift
   * apart: a card and the row that leads to it disagreeing about where a
   * submission stands is exactly the kind of bug two implementations of one
   * rule produce.
   *
   * Ordered by what has to happen next, most pressing first. A package that is
   * short of a paper *and* whose archive search wants signing off is short of a
   * paper: the missing document will be added, the run will happen again, and
   * whatever the register answered about the old envelope is discarded with the
   * report (ADR-0013). Naming the later move now would send the inspector to do
   * work that is about to be thrown away.
   */
  static of(facts: PackageStandingFacts): PackageStanding {
    const { status } = facts;

    if (status.equals(PackageStatus.PENDING)) return PackageStanding.QUEUED;
    if (status.equals(PackageStatus.PROCESSING)) {
      return PackageStanding.UNDER_VERIFICATION;
    }
    if (status.equals(PackageStatus.FAILED)) return PackageStanding.STALLED;

    // Completed: the run reached the end, and what it made of the package is
    // the report's to say. A finished run without one is our machinery having
    // gone wrong rather than a clean submission, and the inspector is told so —
    // `complete()` compiles a report before it finishes, so there is no honest
    // way to be here.
    if (!facts.report) return PackageStanding.STALLED;

    if (facts.report.equals(ReportStatus.INCOMPLETE_PACKAGE)) {
      return PackageStanding.SHORT_OF_DOCUMENTS;
    }
    if (facts.report.equals(ReportStatus.ISSUES_FOUND)) {
      return PackageStanding.NEEDS_INSPECTOR;
    }
    if (facts.askedTheArchive && !facts.archiveSearchApproved) {
      return PackageStanding.AWAITING_ARCHIVE_APPROVAL;
    }

    return PackageStanding.CLEARED;
  }

  equals(other: PackageStanding): boolean {
    return this.value === other.value;
  }
}
