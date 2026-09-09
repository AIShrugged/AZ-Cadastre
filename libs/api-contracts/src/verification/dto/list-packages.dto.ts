import { z } from 'zod';

import { PackageStandingSchema, ReportStatusSchema } from '../enums/index.js';

import { PackageDtoSchema } from './package.dto.js';

// How many rows one call answers with when the caller says nothing, and the
// most it will answer with however loudly the caller asks. The list grows with
// every submission the office takes in, so there is no request that means
// "all of them" — a page is the only shape this endpoint has (ADR-0015).
export const LIST_PACKAGES_DEFAULT_LIMIT = 20;
export const LIST_PACKAGES_MAX_LIMIT = 100;

/**
 * What the list is asked for: a term to look for, the two states it can be
 * narrowed by, and the page of the answer wanted.
 *
 * Query-string values arrive as text, so the two numbers are coerced. Anything
 * the schema refuses — a page size of 500, a standing nobody names — is a 400
 * from the edge and never reaches the context.
 */
export const ListPackagesRequestSchema = z.object({
  /**
   * What the inspector typed. A package matches when the term, ignoring case
   * and the spaces around it, is
   *
   * - exactly its id, or
   * - part of the name of a file uploaded to it, or
   * - part of a value the pipeline read off one of its documents — the
   *   cadastral number, the address, the owner's name.
   *
   * Nothing else: the counts, the dates and the profile key are the row's
   * furniture, not what a submission is known by. An empty term is no term at
   * all rather than a refusal, because that is what a cleared search box sends.
   */
  search: z
    .string()
    .trim()
    .transform(term => (term === '' ? undefined : term))
    .optional(),
  /**
   * Where the submission stands — what has to happen to it next. The state the
   * inspector's list is actually read by, and one of two separate questions:
   * this one is about the submission, `reportStatus` below is about what the
   * run found.
   *
   * Repeatable, and a row matches any of the values given: `?standing=Queued&
   * standing=UnderVerification` is the one slice an inspector calls "in
   * progress". A slice is a set of standings and not a standing, because the
   * seven are what has to happen next and a tab is what somebody is doing —
   * accepted and being read are one job. Without this a tab could only show one
   * of them, and its own count, which is taken over a set, would never add up
   * to what it listed.
   *
   * One value still works and means what it always did, so a caller that sends
   * a single `standing` needs no change. Naming none narrows nothing; naming a
   * standing nobody names is a 400, however many are sent with it.
   */
  standing: z
    .union([PackageStandingSchema, z.array(PackageStandingSchema)])
    .transform(asked => (Array.isArray(asked) ? asked : [asked]))
    // An empty list is no filter rather than a filter that matches nothing —
    // the same reading a cleared search box gets above. A caller that builds
    // the parameter off a set of ticked boxes sends one when they are all
    // cleared, and it means the whole register.
    .transform(asked => (asked.length === 0 ? undefined : asked))
    .optional(),
  /**
   * What the run made of the package. Not the same question as `standing`,
   * which is why it is not the same parameter: every package still being read
   * has no report at all, and `IssuesFound` on a package that has since been
   * re-opened is a report about an envelope that has changed.
   */
  reportStatus: ReportStatusSchema.optional(),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(LIST_PACKAGES_MAX_LIMIT)
    .default(LIST_PACKAGES_DEFAULT_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
});
export type ListPackagesRequest = z.infer<typeof ListPackagesRequestSchema>;
/** The same request as a caller writes it, before the defaults are filled in. */
export type ListPackagesRequestInput = z.input<
  typeof ListPackagesRequestSchema
>;

/**
 * One page of the list, and how many rows the filter matched in total — a pager
 * that cannot say how many pages there are is a pager nobody can use.
 *
 * `limit` and `offset` are echoed rather than left to the caller to remember:
 * the answer says which page it is, so a late response cannot be rendered as
 * the page that was asked for after it.
 */
export const ListPackagesResponseSchema = z.object({
  items: z.array(PackageDtoSchema),
  // Rows the search and the filters matched, not rows in this page.
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
});
export type ListPackagesResponse = z.infer<typeof ListPackagesResponseSchema>;
