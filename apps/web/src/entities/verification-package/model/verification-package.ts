/**
 * Verification Package — the register's core aggregate: the identity an
 * inspector cites, its disposition, and the tallies the pipeline reports.
 *
 * Package summaries are served live by the core API (`GET /api/packages`); the
 * wire DTO and the mapping into this view model live here. Findings come from
 * the report the run finished with, so they are absent until it has. Ubiquitous
 * language follows packages/verification/CONTEXT.md.
 *
 * Which packages are in the list is deliberately *not* here. Searching,
 * narrowing and paging are the endpoint's, over every submission the office has
 * taken in rather than over the page it last sent (ADR-0015) — the register asks
 * for what it wants in `register-query.ts` and draws the answer.
 *
 * What a profile expects is deliberately *not* here. That is policy the engine
 * owns and publishes (`GET /api/profiles`), and a mapper that reached for it
 * would have to keep a copy — which is how "1 of 2" came to be drawn for a
 * package the engine expected three documents for. A screen that wants the total
 * asks `documentsExpected` with the profiles it fetched.
 */
import type {
  PackageDto,
  PackageStanding,
  PackageStatus,
  ReportStatus,
  StatedValueDto,
} from '@cadastre/api-contracts/verification';

export type Disposition =
  'in_progress' | 'ok' | 'issues' | 'incomplete' | 'failed';

export type VerificationPackage = {
  /** Register number — the identity an inspector cites. */
  id: string;
  /** Key of the Verification Profile governing this package, as the server named it. */
  profile: string;
  /**
   * Where the submission stands: what has to happen to it next. Read off the
   * contract, never worked out here (ADR-0014), and the state the register's
   * rows are read and narrowed by.
   */
  standing: PackageStanding;
  /**
   * What the run made of the papers. A separate question from `standing` and
   * never folded into it — a cleared submission may still carry the findings of
   * the run that read it. Null until a run has reported on it.
   */
  reportStatus: ReportStatus | null;
  disposition: Disposition;
  /**
   * Who the submission is for and which property it concerns, as the pipeline
   * read them **off the package's own papers** — not as anything declared at
   * the counter, which is a separate source the contract keeps apart.
   *
   * Null where no document of this package states it yet: the run has not
   * reached the paper, or read nothing off it. Never an empty string and never
   * a placeholder — a row that cannot name the case says so, and the register
   * draws that silence the way it draws every other unknown cell.
   *
   * Each carries the confidence its reading was made with, because a value read
   * badly must not be shown as a fact (`readWellEnough`).
   */
  applicant: StatedValueDto | null;
  address: StatedValueDto | null;
  /** ISO timestamp the package was submitted. */
  submittedAt: string;
  /** ISO timestamp of the last pipeline event (drives "updated Xm ago"). */
  updatedAt: string;
  /** Documents the classifier has placed so far. */
  docsClassified: number;
  /**
   * Documents the pipeline found inside the uploaded files. A file is a
   * container — one PDF may hold several documents — so this is 0 until
   * detection has run and can exceed `filesAttached`.
   */
  docsFound: number;
  /** Files the inspector uploaded. Known from the moment the package exists. */
  filesAttached: number;
  /** Validation issues raised (mismatch / expired / missing). */
  issues: number;
  /** Fields flagged below the confidence threshold. */
  lowConfidence: number;
  /** Lowest field confidence seen, 0–100 (undefined until extraction runs). */
  minConfidence?: number;
  /** For in_progress packages: current stage 1..8. */
  stage?: number;
  /** Optional internal reference the inspector set at creation. */
  reference?: string;
};

/**
 * The package's id as a register reference — the first block of the uuid the
 * database issues. A uuid is how the system names a package, not how a person
 * reads one back: thirty-six characters of hexadecimal cannot be compared down
 * a column, held in the head between two screens, or read aloud over a desk.
 *
 * The short form is a reference, never the identity: the full id travels with
 * it wherever it is shown (the row's title, the details subtitle, the URL), and
 * search still matches on the whole of it, so an id handed over in full still
 * finds its package.
 */
export function packageRef(id: string): string {
  return id.split('-')[0] ?? id;
}

// ─── Wire DTO ⇄ view model ────────────────────────────────────────────────────
// PackageDto / PackageStatus are the shared contracts (@cadastre/api-contracts);
// this maps them into the register's richer view model.

/**
 * What the register stamps on the row. The pipeline lifecycle only says whether
 * a run finished; what it *found* is the report's to say, and every finished run
 * has one — a run is never stopped by what it could not read, so "Completed"
 * covers packages with findings as readily as clean ones.
 */
function dispositionOf(
  status: PackageStatus,
  reportStatus: ReportStatus | null,
): Disposition {
  switch (status) {
    case 'Pending':
    case 'Processing':
      return 'in_progress';
    case 'Completed':
      if (reportStatus === 'IncompletePackage') return 'incomplete';
      if (reportStatus === 'IssuesFound') return 'issues';
      return 'ok';
    case 'Failed':
      return 'failed';
  }
}

/**
 * Map a live package summary into the register's view model. Pipeline-derived
 * fields are defaulted until their stages produce real values.
 */
export function toViewPackage(dto: PackageDto): VerificationPackage {
  const disposition = dispositionOf(dto.status, dto.reportStatus);
  return {
    id: dto.id,
    profile: dto.profileKey,
    standing: dto.standing,
    reportStatus: dto.reportStatus,
    disposition,
    // Passed through as the wire states them, nulls and all: what names the
    // case is the engine's reading, and a mapper that filled a gap here would
    // be inventing the one thing the row is read by.
    applicant: dto.applicantName,
    address: dto.propertyAddress,
    submittedAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    // Grows live as the register polls: detection finds the documents, then
    // classification places them one by one.
    docsClassified: dto.classifiedCount,
    docsFound: dto.documentsCount,
    filesAttached: dto.filesCount,
    issues: dto.issuesCount,
    lowConfidence: dto.lowConfidenceCount,
    stage: disposition === 'in_progress' ? pipelineStage(dto) : undefined,
  };
}

/**
 * Coarse pipeline stage for the register's stage bar, from real progress:
 * reading while no document has been found yet, Classification while types are
 * still being assigned, then Field extraction once extraction has produced
 * fields. A document the classifier cannot place no longer halts anything — it
 * becomes a finding, so the run walks on to the completeness check and the
 * report, which are compiled together when it finishes.
 *
 * A summary carries counts, not per-file progress, so it cannot separate OCR
 * from Document detection — both read as stage 1 here. The detail screen has
 * the files themselves and reports the two apart.
 */
function pipelineStage(dto: PackageDto): number {
  if (dto.documentsCount === 0) return 1; // reading the files
  if (dto.classifiedCount < dto.documentsCount) return 3; // classifying
  if (dto.extractedCount > 0) return 4; // extraction reached
  return 3;
}
