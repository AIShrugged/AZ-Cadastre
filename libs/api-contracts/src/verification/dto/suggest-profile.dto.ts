import { z } from 'zod';

import { SuggestionCriterionSchema } from '../enums/index.js';

import { DECLARED_YEAR_EARLIEST, DECLARED_YEAR_LATEST } from './package.dto.js';

/**
 * What the office has declared so far, as the intake screen asks about it.
 *
 * Both are optional: the screen asks as soon as it has anything, and an answer
 * given on one figure is worth more than no answer until the other arrives.
 * Query-string values arrive as text, so the year is coerced; a year outside
 * the window the engine reads one in is a 400 from the edge.
 */
export const SuggestProfileRequestSchema = z.object({
  legalBasis: z
    .string()
    .trim()
    // A cleared field is nothing declared rather than a basis called "", which
    // is the same reading the list's search box gets.
    .transform(basis => (basis === '' ? undefined : basis))
    .optional(),
  builtYear: z.coerce
    .number()
    .int()
    .min(DECLARED_YEAR_EARLIEST)
    .max(DECLARED_YEAR_LATEST)
    .optional(),
});
export type SuggestProfileRequest = z.infer<typeof SuggestProfileRequestSchema>;
/** The same request as a caller writes it, before the coercion. */
export type SuggestProfileRequestInput = z.input<
  typeof SuggestProfileRequestSchema
>;

/**
 * One thing the suggestion turned on, and what it made of it.
 *
 * The audit line is written in English when the suggestion is made, like every
 * other line this system produces; `criterion` is what lets a reader show it
 * beside the field it is about, in their own language.
 */
export const SuggestionReasonDtoSchema = z.object({
  criterion: SuggestionCriterionSchema,
  note: z.string(),
});
export type SuggestionReasonDto = z.infer<typeof SuggestionReasonDtoSchema>;

/**
 * Which profile the declaration points at, and why.
 *
 * A recommendation and nothing more: the operator chooses the profile, and
 * `POST /packages` takes their choice whatever this said. It is answered with
 * its reasoning rather than as a bare key precisely because it can be
 * overruled — an operator who cannot see why a profile was proposed can only
 * accept it or ignore it.
 *
 * `profileKey` is null where the declaration points at no profile, or at more
 * than one: a system that picked between two profiles the declaration does not
 * choose between would be deciding rather than suggesting. The reasons say
 * which of the two it was, and they are stated either way.
 */
export const ProfileSuggestionDtoSchema = z.object({
  profileKey: z.string().nullable(),
  reasons: z.array(SuggestionReasonDtoSchema),
});
export type ProfileSuggestionDto = z.infer<typeof ProfileSuggestionDtoSchema>;
