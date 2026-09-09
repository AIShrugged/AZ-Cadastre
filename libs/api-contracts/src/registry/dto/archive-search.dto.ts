import { z } from 'zod';

import { MATCH_BAND_FLOOR, SearchCriterionSchema } from '../enums/index.js';

import { ArchiveRecordDtoSchema } from './archive-record.dto.js';

/**
 * How sure the register has to be before it offers a record at all, when the
 * caller does not say.
 *
 * The floor of `Possible`, so the default answer is what a person would call a
 * possible match and better. It is a default and not a policy: an operator
 * hunting a case they know is in there somewhere lowers it and reads the weak
 * rows themselves, and one sweeping for duplicates raises it. What a band is
 * worth is nobody's rule but the reader's (ADR-0009).
 */
export const DEFAULT_SEARCH_THRESHOLD = MATCH_BAND_FLOOR.Possible;

/** How many records one search answers with when the caller says nothing, and
 *  the most it will answer with however loudly they ask. */
export const SEARCH_DEFAULT_LIMIT = 20;
export const SEARCH_MAX_LIMIT = 100;

/**
 * What the operator is searching the archive by.
 *
 * Any one of the three, or several together — and at least one, which is the
 * only thing the register refuses: a search with no criterion is a request for
 * the whole archive, and the archive is not a list.
 *
 * Several criteria narrow and do not widen. A record has to be worth offering
 * on the average of the ones it can answer, so a name and a parcel number
 * together find the record that answers both and rank it above the record that
 * answers one.
 */
export const ArchiveSearchRequestSchema = z
  .object({
    // As the operator has it — in whatever script, with whatever abbreviations
    // and as far as they know it. Making sense of that is the register's job.
    address: z.string().trim().min(1).optional(),
    ownerName: z.string().trim().min(1).optional(),
    cadastralNumber: z.string().trim().min(1).optional(),
    /**
     * How sure the register must be before a record is offered. A record is
     * offered when its confidence reaches it.
     *
     * In the request and not a constant of the register, because how much
     * doubt is worth reading through depends on why somebody is searching, and
     * the register does not know why (ADR-0009). The bands the number is read
     * in are `MATCH_BAND_FLOOR`.
     */
    threshold: z.number().min(0).max(1).default(DEFAULT_SEARCH_THRESHOLD),
    limit: z.coerce
      .number()
      .int()
      .min(1)
      .max(SEARCH_MAX_LIMIT)
      .default(SEARCH_DEFAULT_LIMIT),
  })
  .refine(
    asked =>
      asked.address !== undefined ||
      asked.ownerName !== undefined ||
      asked.cadastralNumber !== undefined,
    {
      message:
        'A search names at least one of address, ownerName or cadastralNumber.',
      path: ['address'],
    },
  );
export type ArchiveSearchRequest = z.infer<typeof ArchiveSearchRequestSchema>;
/** The same request as a caller writes it, before the defaults are filled in. */
export type ArchiveSearchRequestInput = z.input<
  typeof ArchiveSearchRequestSchema
>;

/**
 * Which of the archive's registers a record was read out of.
 *
 * Two names because there are two questions. `name` is what the record itself
 * carries — `EMDK:Mulkuyat`, `Hövsan:qəbul edilən`, `пасбаза` — the register
 * and, where it matters, the sheet: two sheets of one workbook disagree about
 * what a row records. `register` is the line of the catalogue it belongs to,
 * the same identifier `RegistrySummaryResponse` counts under, so a match can be
 * read against how much of that source is loaded.
 */
export const RecordSourceDtoSchema = z.object({
  name: z.string(),
  register: z.string(),
});
export type RecordSourceDto = z.infer<typeof RecordSourceDtoSchema>;

/**
 * One criterion the caller searched by, and how the record stood against it.
 *
 * `confidence` is null where the record is silent — the registers disagree
 * about which columns they carry, so a register that never had a cadastral
 * number column says nothing about one rather than disagreeing. Silence is not
 * counted for or against: it is left out of the record's own confidence, and
 * the caller can see it was.
 */
export const MatchedCriterionDtoSchema = z.object({
  criterion: SearchCriterionSchema,
  // What the operator typed, as they typed it.
  submitted: z.string(),
  // What the record says, in the record's own wording. Null where it says
  // nothing. For the address it is the spelling that answered — a record holds
  // several, and the one that matched is not always the one it is filed under.
  recorded: z.string().nullable(),
  confidence: z.number().min(0).max(1).nullable(),
});
export type MatchedCriterionDto = z.infer<typeof MatchedCriterionDtoSchema>;

/**
 * One record the archive offers, with how sure it is and where it came from.
 *
 * `confidence` is the average over the criteria the record could answer, and
 * over nothing else: a record silent about the cadastral number is not thereby
 * a worse match on the name it does carry. The trade is that two records can
 * share a confidence while one answered more of the question, so a caller
 * reading the number alone is reading half of it — `criteria` is the other
 * half, and the order the matches arrive in already accounts for both.
 */
export const ArchiveMatchDtoSchema = z.object({
  record: ArchiveRecordDtoSchema,
  source: RecordSourceDtoSchema,
  confidence: z.number().min(0).max(1),
  // One line per criterion the caller searched by, in the order the criteria
  // are named above.
  criteria: z.array(MatchedCriterionDtoSchema),
  /**
   * Another source answers for this property and says something else. What it
   * says is in `disagreements`; this is the flag a row is drawn with, so a
   * reader is not left to join two lists to find out that the record in front
   * of them is contested.
   */
  disputed: z.boolean(),
});
export type ArchiveMatchDto = z.infer<typeof ArchiveMatchDtoSchema>;

/** What one source says about a field the sources do not agree on. */
export const SourceStatementDtoSchema = z.object({
  source: z.string(),
  value: z.string(),
});
export type SourceStatementDto = z.infer<typeof SourceStatementDtoSchema>;

/**
 * Two sources answering for one property and disagreeing about it.
 *
 * The archive is six registers kept by different offices over thirty years and
 * they overlap; where they overlap they contradict each other, and the Hövsan
 * handover registers do it by design — the same house is recorded twice, under
 * two offices, with the holder of record changed between them. Which of the two
 * is right is not the register's to say and never was (ADR-0010): it says that
 * they differ, names both sources and quotes both values, and somebody who can
 * open the folder decides.
 *
 * Silence is not disagreement. A source that carries no column for a field is
 * not one of the statements here.
 */
export const SourceDisagreementDtoSchema = z.object({
  // The property the sources disagree about, as the register spells the
  // address that grouped them.
  subject: z.string(),
  // The field of the record they disagree about: `ownerName`,
  // `cadastralNumber`, `plotArea`.
  field: z.string(),
  statements: z.array(SourceStatementDtoSchema),
});
export type SourceDisagreementDto = z.infer<typeof SourceDisagreementDtoSchema>;

/**
 * What the archive offers for the search, and nothing more.
 *
 * There is no verdict here, for the same reason a lookup carries none: a record
 * the register is 0.62 sure of is a fact about two strings, and what it means
 * for anybody's application is the caller's rule (ADR-0009). There is no band
 * either — the register answers with the number it computed, and the four bands
 * are drawn by whoever shows them, at the floors the contract names.
 */
export const ArchiveSearchResponseSchema = z.object({
  // The threshold actually applied — the caller's, or the default it was left
  // at. Echoed so an answer says what it was answering, and a late one cannot
  // be read as the answer to a narrower question asked after it.
  threshold: z.number().min(0).max(1),
  // The records offered, the surest first. Never more than `limit` of them.
  matches: z.array(ArchiveMatchDtoSchema),
  // How many records cleared the threshold in all, so a page says whether
  // there is more behind it.
  matched: z.number().int().nonnegative(),
  // How many records the register compared at all. The denominator of the
  // sentence in `note`, and the only honest measure of how wide the net was.
  considered: z.number().int().nonnegative(),
  // The sources that answered, by the names their records carry — over
  // everything that cleared the threshold and not only over this page. Empty
  // when nothing cleared it.
  sources: z.array(z.string()),
  // Every property two of those sources answered for differently. Stated over
  // everything that cleared the threshold and not only over this page: a
  // contradiction that fell off the end of the page is still a contradiction.
  disagreements: z.array(SourceDisagreementDtoSchema),
  // The audit line, written in English when the search was answered.
  note: z.string(),
});
export type ArchiveSearchResponse = z.infer<typeof ArchiveSearchResponseSchema>;
