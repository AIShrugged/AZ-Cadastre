import type { ObjectImport } from '../registry-import.schema.js';

/**
 * Where records are written, as a port for the same reason reading is one.
 *
 * Loading the archive's own registers is an operation on the register and not a
 * question asked of it, so it is a second port rather than a method on
 * `RegistrySource`: a source that answered lookups out of a real state register
 * would have nothing to implement here, and a caller that only reads should not
 * be handed something that writes.
 */
export abstract class RegistryWriter {
  /**
   * Store every object with its child rows, keyed on `(territorialOffice,
   * registerNo)`.
   *
   * Idempotent, the same way the seed is: the object is upserted on its key and
   * the rows that hang off it are replaced rather than merged, so loading a
   * corrected workbook a second time leaves the register holding what the
   * workbook says and not the union of both attempts.
   */
  abstract upsert(objects: readonly ObjectImport[]): Promise<void>;
}
