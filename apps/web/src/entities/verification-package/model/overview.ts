/**
 * The summary of a period, shaped for reading.
 *
 * What lives here is only what a client may decide about the four slices the
 * endpoint answers with: which tone each class is drawn in, which line of the
 * dictionary names it, and what share of its own tally it is. Not one number is
 * worked out here — every count is the server's, taken in a single transaction
 * so that all four slices describe the same instant (ADR-0017), and a client
 * that recomputed any of them would be publishing a second answer.
 *
 * **The two rules this module exists to hold.** A tally with nothing in it is
 * still a tally: `share` is 0 and never `NaN`, so an office that has taken
 * nothing in draws an empty bar rather than a broken one — and the screen tells
 * that apart from "not asked yet" by never rendering this at all until an
 * answer has arrived. And findings held **against** a package and observations
 * stated **for the record** are ranked separately and never summed, by the
 * report's own rule: a summary that added the two would announce faults in
 * submissions that have none.
 */
import type {
  ArchiveTallyDto,
  FindingTallyDto,
  IssueKind,
  OutcomeTallyDto,
  PackageStatus,
  PipelineTallyDto,
  RegistryOutcome,
  ReportStatus,
} from '@cadastre/api-contracts/verification';

import { OUTCOME_KEY, OUTCOME_TONE, type OutcomeTone } from './archive-search';
import { REPORT_KEY, REPORT_TONE } from './report-outcome';

/**
 * The tones a slice of a tally is drawn in.
 *
 * The register's own five (`OutcomeTone`) carry every class that reports an
 * outcome, so "agreed" reads alike whether it was said by a cross-document
 * check, by the archive register, or by this summary. The four added here are
 * the conveyor's: three steps of one indigo ramp, light → dark as a submission
 * gets further along, plus the reserved failed ink.
 *
 * `failed` is deliberately not a fourth step of that ramp. The ramp encodes
 * progress, and a broken-down run is not a position on it — it is the conveyor
 * having stopped, which is a different kind of fact and wears the disposition
 * ink the whole surface keeps for it.
 */
export type SliceTone =
  OutcomeTone | 'conveyor-1' | 'conveyor-2' | 'conveyor-3' | 'failed';

/** One class of a tally: what it is called, how many, and how much of the whole. */
export type TallySlice = {
  /** The contract's own name for the class. */
  id: string;
  labelKey: string;
  tone: SliceTone;
  count: number;
  /** 0…1 of the tally's total. Zero when the tally is empty — never `NaN`. */
  share: number;
};

/** A whole tally: its classes and what they are a share of. */
export type Tally = {
  total: number;
  slices: readonly TallySlice[];
};

function shareOf(count: number, total: number): number {
  return total > 0 ? count / total : 0;
}

// ─── Where the work is ──────────────────────────────────────────────────────

/**
 * The conveyor's states in the order a submission passes through them, with the
 * one that is not a state on it last.
 *
 * Read off a written order rather than off the answer's keys: a record's key
 * order is whatever the server serialised, and a bar whose segments reshuffle
 * between two polls is a bar nobody can read.
 */
export const CONVEYOR_ORDER: readonly PackageStatus[] = [
  'Pending',
  'Processing',
  'Completed',
  'Failed',
];

export const CONVEYOR_KEY: Record<PackageStatus, string> = {
  Pending: 'summary.pipeline.pending',
  Processing: 'summary.pipeline.processing',
  Completed: 'summary.pipeline.completed',
  Failed: 'summary.pipeline.failed',
};

const CONVEYOR_TONE: Record<PackageStatus, SliceTone> = {
  Pending: 'conveyor-1',
  Processing: 'conveyor-2',
  Completed: 'conveyor-3',
  Failed: 'failed',
};

export function pipelineTally(pipeline: PipelineTallyDto): Tally {
  return {
    total: pipeline.total,
    slices: CONVEYOR_ORDER.map(status => ({
      id: status,
      labelKey: CONVEYOR_KEY[status],
      tone: CONVEYOR_TONE[status],
      // Every member of the vocabulary is present in the answer, at zero where
      // no submission is in it. The fallback is for the build that meets a
      // server older than its own contract, not for a hole the schema allows.
      count: pipeline.byStatus[status] ?? 0,
      share: shareOf(pipeline.byStatus[status] ?? 0, pipeline.total),
    })),
  };
}

/**
 * How many submissions of the period the machinery broke down on.
 *
 * Pulled out of the tally and named on its own because it is the only thing on
 * this screen that no amount of waiting resolves: a queued submission becomes a
 * read one by itself, and a stalled one never does. The screen leads with this
 * and draws it whether or not the rest of the summary is unfolded.
 */
export function stalledCount(pipeline: PipelineTallyDto): number {
  return pipeline.byStatus.Failed ?? 0;
}

// ─── What the runs made of them ─────────────────────────────────────────────

/**
 * The outcomes in the order the register's own filter lists them, so the two
 * controls on one screen offer one order.
 */
export const OUTCOME_ORDER: readonly ReportStatus[] = [
  'OK',
  'IssuesFound',
  'IncompletePackage',
];

/**
 * What the runs concluded — over the submissions of the period that have a
 * report, which is fewer than the period took in. A submission still being read
 * has no outcome yet and is counted in the conveyor slice rather than guessed
 * at here, which is why this tally has a total of its own.
 */
export function outcomeTally(outcomes: OutcomeTallyDto): Tally {
  return {
    total: outcomes.total,
    slices: OUTCOME_ORDER.map(status => ({
      id: status,
      labelKey: REPORT_KEY[status],
      tone: REPORT_TONE[status],
      count: outcomes.byStatus[status] ?? 0,
      share: shareOf(outcomes.byStatus[status] ?? 0, outcomes.total),
    })),
  };
}

// ─── What the archive register answered ─────────────────────────────────────

/**
 * The five answers, agreement first and the two the register cannot settle
 * last. `NotFound` sits with `Ambiguous` and not with `Differs` on purpose:
 * those two are the register not knowing, and the order is part of saying so.
 */
export const ARCHIVE_ORDER: readonly RegistryOutcome[] = [
  'Confirmed',
  'Differs',
  'Incomplete',
  'NotFound',
  'Ambiguous',
];

/**
 * How the archive answered, counted per question put to it rather than per
 * submission: a profile may ask it more than one, and a submission it was never
 * asked about is in none of these numbers.
 *
 * `NotFound` keeps a number of its own and is never folded in with `Differs`.
 * The register's coverage is partial and historical, so its silence about a
 * property is an absence of evidence and not a disagreement with the papers
 * (ADR-0009) — it takes the neutral `silent` tone the whole surface draws it
 * in, and one number over both would report a gap in the archive as a fault in
 * the submissions.
 */
export function archiveTally(archive: ArchiveTallyDto): Tally {
  return {
    total: archive.total,
    slices: ARCHIVE_ORDER.map(outcome => ({
      id: outcome,
      labelKey: OUTCOME_KEY[outcome],
      tone: OUTCOME_TONE[outcome],
      count: archive.byOutcome[outcome] ?? 0,
      share: shareOf(archive.byOutcome[outcome] ?? 0, archive.total),
    })),
  };
}

// ─── What goes wrong most often ─────────────────────────────────────────────

/**
 * The name of each kind of finding, in the reader's language.
 *
 * The same lines the report's own sections are headed with, and deliberately
 * not a second set: a kind named one thing on a package and another in the
 * summary of a hundred of them is two vocabularies for one idea. The detail
 * page reads its section headings from here for that reason.
 */
export const ISSUE_KIND_KEY: Record<IssueKind, string> = {
  MissingDocument: 'detail.sec.missing',
  UnreadableDocument: 'detail.sec.unreadable',
  LowConfidence: 'detail.sec.low',
  FieldMismatch: 'detail.sec.mismatch',
  RegistryMismatch: 'detail.sec.registry_mismatch',
  RegistryDocumentMissing: 'detail.sec.registry_document_missing',
  ExtraDocument: 'detail.sec.extra',
  DuplicateDocument: 'detail.sec.duplicate',
  RegistryUnconfirmed: 'detail.sec.registry_unconfirmed',
  MissingAttestation: 'detail.sec.attestation',
  SupportingDocumentsRequired: 'detail.sec.supporting',
};

export type FindingRank = {
  kind: IssueKind;
  count: number;
  /**
   * 0…1 against the *most frequent* kind of this tally, which is the length of
   * the bar. Ranked against its neighbours and not against the total: the
   * question this slice answers is which kinds come up most, and a set of bars
   * measured against a total nobody named would be five slivers.
   */
  share: number;
};

export type FindingRanking = {
  total: number;
  ranked: readonly FindingRank[];
  /**
   * Kinds this tally names that did not occur once in the period.
   *
   * Counted rather than drawn. The contract lists every kind at zero so no kind
   * can silently vanish, but a row of empty bars is noise in a chart whose
   * whole subject is frequency — so the zeros are stated in a line of text
   * instead, which keeps "none this period" from reading as "we do not have
   * such a finding".
   */
  unseen: number;
};

/**
 * The kinds that occurred, most frequent first.
 *
 * Sorted here rather than trusted from the wire — the answer already arrives in
 * this order, and sorting a sorted list costs nothing next to a screen that
 * would silently mis-rank if that ever changed. The sort is stable, so kinds
 * that came up the same number of times keep the contract's own order between
 * them instead of shuffling from one poll to the next.
 */
export function rankFindings(tally: FindingTallyDto): FindingRanking {
  const seen = tally.byKind.filter(entry => entry.count > 0);
  const ranked = [...seen].sort((a, b) => b.count - a.count);
  const most = ranked[0]?.count ?? 0;

  return {
    total: tally.total,
    unseen: tally.byKind.length - seen.length,
    ranked: ranked.map(entry => ({
      kind: entry.kind,
      count: entry.count,
      share: shareOf(entry.count, most),
    })),
  };
}
