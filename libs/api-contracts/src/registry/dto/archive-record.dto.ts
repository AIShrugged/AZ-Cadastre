import { z } from 'zod';

import { DocumentHoldingSchema } from '../enums/index.js';

/**
 * Where the paper is. Folder and page are strings and never numbers: real
 * values include "01-dən 30" and "06-DƏK səh. 48", and a column headed "page
 * (to)" is not always a page.
 */
export const ArchiveLocationDtoSchema = z.object({
  folder: z.string(),
  pages: z.string(),
});
export type ArchiveLocationDto = z.infer<typeof ArchiveLocationDtoSchema>;

/**
 * One paper the archive holds — or is known not to hold — for a property.
 *
 * It is the register's own word for the document ("Ərizə", "Sərəncam
 * çıxarışı"), never the caller's document type: the two vocabularies were
 * written decades apart and by different offices, so whoever asks names both
 * (ADR-0010).
 *
 * Number and date are as written and are frequently absent: the presence
 * registers record that a paper is in the file without restating what is on it.
 */
export const ArchiveDocumentDtoSchema = z.object({
  name: z.string(),
  holding: DocumentHoldingSchema,
  // As written. The source registers fuse a certificate number with its date in
  // one cell — "08812     12.01.1998" — so this is text and never parsed here.
  number: z.string().nullable(),
  issuedOn: z.string().nullable(),
  issuingAuthority: z.string().nullable(),
  // Where this particular paper is, when the register knows it apart from the
  // folder the whole case sits in.
  location: ArchiveLocationDtoSchema.nullable(),
});
export type ArchiveDocumentDto = z.infer<typeof ArchiveDocumentDtoSchema>;

/**
 * One property as the archive registers hold it. Every field but the register
 * number is nullable: the registers disagree on which columns they carry, and a
 * column an area's register never had is silence rather than an empty value.
 */
export const ArchiveRecordDtoSchema = z.object({
  // The key records are joinable by across the register files.
  registerNo: z.string(),
  inventoryNo: z.string().nullable(),
  // The address as the record spells it, which is not how the submission does.
  address: z.string(),
  ownerName: z.string().nullable(),
  cadastralNumber: z.string().nullable(),
  // As written, with its unit: "600 m²", "1,2 sot".
  plotArea: z.string().nullable(),
  location: ArchiveLocationDtoSchema.nullable(),
  // Every paper the register knows about for this property, in the order it
  // keeps them. Empty where the register holds the object but no list of its
  // papers — which is most of the older files.
  documents: z.array(ArchiveDocumentDtoSchema).default([]),
});
export type ArchiveRecordDto = z.infer<typeof ArchiveRecordDtoSchema>;
