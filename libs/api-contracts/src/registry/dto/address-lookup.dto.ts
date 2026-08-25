import { z } from 'zod';

import { AttributeMatchSchema, LookupOutcomeSchema } from '../enums/index.js';

import { ArchiveRecordDtoSchema } from './archive-record.dto.js';

/** One thing the caller says about the property, for the record to be held against. */
export const SubmittedAttributeSchema = z.object({
  // A field of the record: "ownerName" | "cadastralNumber" | "plotArea".
  name: z.string().min(1),
  value: z.string().min(1),
});
export type SubmittedAttribute = z.infer<typeof SubmittedAttributeSchema>;

export const AddressLookupRequestSchema = z.object({
  // As the submission states it, in whatever script and with whatever
  // abbreviations it was written in. Normalising it is the register's job.
  address: z.string().trim().min(1),
  attributes: z.array(SubmittedAttributeSchema).default([]),
});
export type AddressLookupRequest = z.infer<typeof AddressLookupRequestSchema>;

export const CheckedAttributeDtoSchema = z.object({
  name: z.string(),
  match: AttributeMatchSchema,
  submitted: z.string(),
  recorded: z.string().nullable(),
});
export type CheckedAttributeDto = z.infer<typeof CheckedAttributeDtoSchema>;

/**
 * What the register has to say, and nothing more.
 *
 * There is no "valid" here on purpose. The register states facts — whether it
 * holds a record, how it spells the address, which of the supplied attributes
 * its record agrees with — and what any of that means for a submission is a
 * rule that belongs to the caller's profile, not to the reference data
 * (ADR-0009).
 */
export const AddressLookupResponseSchema = z.object({
  outcome: LookupOutcomeSchema,
  // The address as the register spells it. Null when nothing was found.
  canonicalAddress: z.string().nullable(),
  // The single record the lookup resolved to. Null unless the outcome is Found:
  // an ambiguous lookup deliberately hands back no record to act on.
  record: ArchiveRecordDtoSchema.nullable(),
  // How many records answered to the address, so an ambiguous answer says how
  // ambiguous.
  candidates: z.number().int().nonnegative(),
  // One line per attribute the caller supplied, in the order they supplied
  // them. Empty when the register found nothing to compare against.
  attributes: z.array(CheckedAttributeDtoSchema),
  // The audit line, written in English when the lookup was answered.
  note: z.string(),
});
export type AddressLookupResponse = z.infer<typeof AddressLookupResponseSchema>;
