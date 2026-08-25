import { z } from 'zod';

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
});
export type ArchiveRecordDto = z.infer<typeof ArchiveRecordDtoSchema>;
