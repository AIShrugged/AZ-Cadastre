import { z } from 'zod';

import {
  IssueKindSchema,
  PackageStatusSchema,
  RegistryOutcomeSchema,
  ReportStatusSchema,
} from '../enums/index.js';

/**
 * The window the overview covers, over the moment a submission was **accepted**
 * — never over when a report was compiled or when the register answered.
 *
 * One anchor for all four slices, because four slices anchored on four
 * timestamps would be four answers about four different sets of submissions,
 * and the reader would be left adding up numbers that were never about the same
 * packages. "August" here means the submissions taken in during August, and
 * everything said below is said about those.
 *
 * `from` is inclusive and `to` is exclusive, so a month is
 * `2026-08-01T00:00:00Z .. 2026-09-01T00:00:00Z` and no submission falls in the
 * crack between two adjacent periods. Either may be left out: nothing given at
 * all is every submission the office has ever taken in.
 *
 * Query-string values arrive as text; anything that is not an ISO-8601 instant
 * — or a period that ends before it starts — is a 400 from the edge and never
 * reaches the context (ADR-0017).
 */
export const PackagesOverviewRequestSchema = z
  .object({
    from: z.iso.datetime({ offset: true }).optional(),
    to: z.iso.datetime({ offset: true }).optional(),
  })
  .refine(
    period =>
      period.from === undefined ||
      period.to === undefined ||
      Date.parse(period.from) <= Date.parse(period.to),
    {
      // A period that ends before it starts is a caller's mistake, and it is
      // said so rather than answered with zeros — which would read like an
      // office that took nothing in.
      message: 'from must not be later than to',
      path: ['from'],
    },
  );
export type PackagesOverviewRequest = z.infer<
  typeof PackagesOverviewRequestSchema
>;

/** The period as a caller writes it, before the schema has looked at it. */
export type PackagesOverviewRequestInput = z.input<
  typeof PackagesOverviewRequestSchema
>;

const CountSchema = z.number().int().nonnegative();

/**
 * How far along the conveyor the submissions of the period are: waiting, being
 * read, read, and broken down.
 *
 * `Failed` is the one that matters more than the rest together — it is the only
 * state here that no amount of waiting resolves, because the machinery stopped
 * rather than the papers being short of something. A reader putting this on a
 * screen puts that number where it cannot be missed.
 *
 * Keyed by the pipeline's own states and not by `PackageStanding`: this slice
 * answers "how much work is in the machine", and the standing answers "what has
 * to happen next", which is the list's question and not this one (ADR-0014).
 */
export const PipelineTallyDtoSchema = z.object({
  // Submissions accepted in the period. The base every other slice is about.
  total: CountSchema,
  // Every state the pipeline names, present whether or not any submission is in
  // it: a tile that vanishes when it reaches zero is a tile a reader cannot
  // trust to be there. A record over the enum, so an answer short of a member
  // is one this schema refuses rather than one a client has to guard against.
  byStatus: z.record(PackageStatusSchema, CountSchema),
});
export type PipelineTallyDto = z.infer<typeof PipelineTallyDtoSchema>;

/**
 * What the runs made of those submissions: nothing held against them, findings
 * held against them, or a set of papers that was short.
 *
 * `total` is the submissions of the period that have a report, which is fewer
 * than `pipeline.total` — one still being read has no outcome yet, and it is
 * counted in the pipeline slice rather than guessed at here.
 */
export const OutcomeTallyDtoSchema = z.object({
  total: CountSchema,
  byStatus: z.record(ReportStatusSchema, CountSchema),
});
export type OutcomeTallyDto = z.infer<typeof OutcomeTallyDtoSchema>;

export const FindingCountDtoSchema = z.object({
  kind: IssueKindSchema,
  count: CountSchema,
});
export type FindingCountDto = z.infer<typeof FindingCountDtoSchema>;

/**
 * One tally of findings by kind, most frequent first — which is the whole
 * question this slice answers: what goes wrong often is a problem in the
 * process, and what goes wrong once is a problem in one envelope.
 *
 * An ordered list rather than a record, unlike the slices above, because here
 * the order **is** the answer. Every kind that belongs to this tally is listed,
 * at zero where it never occurred: a kind missing from the list would read as
 * "we do not have such a finding" rather than "none this period".
 */
export const FindingTallyDtoSchema = z.object({
  total: CountSchema,
  byKind: z.array(FindingCountDtoSchema),
});
export type FindingTallyDto = z.infer<typeof FindingTallyDtoSchema>;

/**
 * The findings of the period, in the two groups the report itself keeps them
 * in, and never added into one number.
 *
 * A finding held **against** the package is a shortfall somebody has to
 * resolve. An observation is stated **for the record**: the registry's own
 * service sheets in the envelope, a title resting on a chain of two acts, a
 * register that holds nothing about the property, the papers the applicant
 * still has to bring. A report carrying nothing but observations still reads
 * OK, and a summary that summed the two would announce faults in submissions
 * that have none. That split is the report's own rule — see the note on
 * `PackageDto.issuesCount`, which counts by the same one.
 */
export const FindingsOverviewDtoSchema = z.object({
  againstPackage: FindingTallyDtoSchema,
  observations: FindingTallyDtoSchema,
});
export type FindingsOverviewDto = z.infer<typeof FindingsOverviewDtoSchema>;

/**
 * How the archive register answered, counted per question put to it rather than
 * per submission: a profile may ask it more than one, and a submission it was
 * never asked about is in none of these numbers.
 *
 * Every outcome keeps its own number, and `NotFound` in particular is never
 * folded in with `Differs`. The register's coverage is partial and historical,
 * so its silence about a property is an absence of evidence and not a
 * disagreement with the papers (ADR-0009); one number over both would report a
 * gap in the archive as a fault in the submissions.
 */
export const ArchiveTallyDtoSchema = z.object({
  // Questions put to the register about the submissions of the period.
  total: CountSchema,
  byOutcome: z.record(RegistryOutcomeSchema, CountSchema),
});
export type ArchiveTallyDto = z.infer<typeof ArchiveTallyDtoSchema>;

/**
 * The four things an inspector opens a summary to ask, answered together:
 * how much work is in the machine, what the runs made of it, what goes wrong
 * most often, and how the archive answers.
 *
 * One answer and not four calls. Asked separately, the numbers on the screen
 * would be from four different moments and would not add up — a submission that
 * finishes between two calls is counted as processing by one and as reported on
 * by the next. This is read in a single database transaction so every number
 * describes the same instant.
 *
 * Derived from what the packages, reports, findings and register answers
 * already hold. Nothing accumulates it and there is no table to keep in step
 * (the same reasoning as `PackageStanding`, ADR-0014). Why these four questions
 * and not others, and why they are one call: ADR-0017.
 */
export const PackagesOverviewResponseSchema = z.object({
  // The window this answer covers, echoed rather than left to the caller to
  // remember — so a late answer cannot be rendered under the period asked for
  // after it. Null where the caller named no bound.
  period: z.object({
    from: z.string().nullable(),
    to: z.string().nullable(),
  }),
  pipeline: PipelineTallyDtoSchema,
  outcomes: OutcomeTallyDtoSchema,
  findings: FindingsOverviewDtoSchema,
  archive: ArchiveTallyDtoSchema,
});
export type PackagesOverviewResponse = z.infer<
  typeof PackagesOverviewResponseSchema
>;
