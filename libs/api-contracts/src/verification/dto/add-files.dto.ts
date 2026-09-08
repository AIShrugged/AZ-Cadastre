import { z } from 'zod';

import { FileInputSchema } from './create-package.dto.js';
import { PackageDtoSchema } from './package.dto.js';

/**
 * Files that arrived after the package did: the document the report said was
 * missing, or a readable scan of a sheet nobody could read.
 *
 * They travel the same road as the files a package is created with —
 * `documents/presign` signs the URL, the browser PUTs the bytes, and this is
 * handed the keys. There is one way to put a file in the store, and this is not
 * a second one.
 */
export const AddFilesRequestSchema = z.object({
  // At least one: adding nothing would still re-open a package that had been
  // reported on, which is a change nobody asked for.
  files: z.array(FileInputSchema).min(1),
});
export type AddFilesRequest = z.infer<typeof AddFilesRequestSchema>;

export const AddFilesResponseSchema = PackageDtoSchema;
export type AddFilesResponse = z.infer<typeof AddFilesResponseSchema>;
