import { z } from 'zod';

import {
  CaseParameterSchema,
  LandPurposeSchema,
  LandRightSchema,
} from '../enums/index.js';

import {
  DECLARED_YEAR_EARLIEST,
  DECLARED_YEAR_LATEST,
  PackageDetailDtoSchema,
} from './package.dto.js';

/**
 * One of the six figures of the Article 8 decision table, as an operator sets
 * it (COMM-193).
 *
 * A figure per parameter, each held to what that parameter can be: a year in
 * the window above, a positive whole number of storeys, a positive measurement
 * in metres, or one of the two words the contract classes the land by. A figure
 * the table could never be decided on is a 400 from the schema and never a call
 * into the context — an override is believed absolutely, so an impossible one
 * would decide the case.
 *
 * `value: null` clears the override and puts the figure back to what the papers
 * say. It is the revert, and it is the only way back: while an override stands
 * nothing the engine reads displaces it.
 */
export const CaseParameterStatementSchema = z.discriminatedUnion('parameter', [
  z.object({
    // The same window a year read off a paper is held to, and the one a year
    // declared at intake is: an operator cannot state a figure the engine could
    // never have read.
    parameter: z.literal('builtYear'),
    value: z
      .number()
      .int()
      .min(DECLARED_YEAR_EARLIEST)
      .max(DECLARED_YEAR_LATEST)
      .nullable(),
  }),
  z.object({
    parameter: z.literal('storeys'),
    value: z.number().int().positive().nullable(),
  }),
  // Metres. A building has neither a height nor a span of nought.
  z.object({
    parameter: z.literal('height'),
    value: z.number().positive().nullable(),
  }),
  z.object({
    parameter: z.literal('span'),
    value: z.number().positive().nullable(),
  }),
  z.object({
    parameter: z.literal('landRight'),
    value: LandRightSchema.nullable(),
  }),
  z.object({
    parameter: z.literal('purpose'),
    value: LandPurposeSchema.nullable(),
  }),
]);
export type CaseParameterStatement = z.infer<
  typeof CaseParameterStatementSchema
>;

/**
 * What an operator states the case's figures are (COMM-193).
 *
 * One call carries every figure they set, because that is what an operator
 * does: they fix a form and they save it. A package re-opened per keystroke
 * would run the whole pipeline six times over one correction, and five of those
 * runs would be reading a form the operator was still in the middle of — the
 * same reason a document's fields are saved together (ADR-0033).
 *
 * Six entries at most and each parameter once, because there are six figures:
 * a seventh entry, or a second naming a figure already named, is a request
 * whose meaning would depend on which of them the server applied last.
 */
export const StateCaseParametersRequestSchema = z.object({
  parameters: z
    .array(CaseParameterStatementSchema)
    .min(1)
    .max(CaseParameterSchema.options.length)
    .refine(
      parameters =>
        new Set(parameters.map(one => one.parameter)).size ===
        parameters.length,
      { message: 'Each case parameter may be stated once per request' },
    ),
});
export type StateCaseParametersRequest = z.infer<
  typeof StateCaseParametersRequestSchema
>;

/**
 * The submission as it now stands, the override and all — the resource the
 * figure is visible on, so a caller that has just set one does not have to ask
 * for the package again to see what it did. The same answer a correction gets,
 * for the same reason.
 */
export const StateCaseParametersResponseSchema = PackageDetailDtoSchema;
export type StateCaseParametersResponse = z.infer<
  typeof StateCaseParametersResponseSchema
>;
