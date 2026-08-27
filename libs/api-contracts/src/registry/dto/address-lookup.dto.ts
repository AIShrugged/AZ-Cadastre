import { z } from 'zod';

import {
  AttributeMatchSchema,
  DocumentHoldingSchema,
  LookupOutcomeSchema,
} from '../enums/index.js';

import {
  ArchiveLocationDtoSchema,
  ArchiveRecordDtoSchema,
} from './archive-record.dto.js';

/** One thing the caller says about the property, for the record to be held against. */
export const SubmittedAttributeSchema = z.object({
  // A field of the record: "ownerName" | "cadastralNumber" | "plotArea".
  name: z.string().min(1),
  value: z.string().min(1),
});
export type SubmittedAttribute = z.infer<typeof SubmittedAttributeSchema>;

/**
 * One paper the caller's submission carries, for the archive to say whether it
 * holds the original.
 *
 * Two names, because there are two vocabularies. `name` is the register's own
 * word for the kind of paper — the only one it can look anything up by. `type`
 * is the caller's, carried through untouched so a finding lands on the document
 * the inspector opens; the register never reads it.
 */
export const SubmittedDocumentSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
});
export type SubmittedDocument = z.infer<typeof SubmittedDocumentSchema>;

export const AddressLookupRequestSchema = z.object({
  // As the submission states it, in whatever script and with whatever
  // abbreviations it was written in. Normalising it is the register's job.
  address: z.string().trim().min(1),
  attributes: z.array(SubmittedAttributeSchema).default([]),
  // Which papers to say something about. Empty asks about none: the register
  // does not volunteer a holdings list, because what a caller needs to see in
  // the archive is its own rule and not the register's.
  documents: z.array(SubmittedDocumentSchema).default([]),
});
export type AddressLookupRequest = z.infer<typeof AddressLookupRequestSchema>;

export const CheckedAttributeDtoSchema = z.object({
  name: z.string(),
  match: AttributeMatchSchema,
  submitted: z.string(),
  recorded: z.string().nullable(),
});
export type CheckedAttributeDto = z.infer<typeof CheckedAttributeDtoSchema>;

/** One paper the caller asked about, and what the archive holds under it. */
export const CheckedDocumentDtoSchema = z.object({
  name: z.string(),
  // The caller's own type key, handed back unread.
  type: z.string(),
  holding: DocumentHoldingSchema,
  // What the record says about the paper it holds. Null where it holds none,
  // or holds it without restating what is on it.
  number: z.string().nullable(),
  issuedOn: z.string().nullable(),
  location: ArchiveLocationDtoSchema.nullable(),
});
export type CheckedDocumentDto = z.infer<typeof CheckedDocumentDtoSchema>;

/**
 * What the register has to say, and nothing more.
 *
 * There is no "valid" here on purpose. The register states facts — whether it
 * holds a record, how it spells the address, which of the supplied attributes
 * its record agrees with, which of the named papers it holds, and the archive
 * locator — and what any of that means for a submission is a rule that belongs
 * to the caller's profile, not to the reference data (ADR-0009).
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
  // One line per paper the caller named, in the order they named them. Empty
  // when the register found nothing to look for them in.
  documents: z.array(CheckedDocumentDtoSchema),
  // The audit line, written in English when the lookup was answered.
  note: z.string(),
});
export type AddressLookupResponse = z.infer<typeof AddressLookupResponseSchema>;
