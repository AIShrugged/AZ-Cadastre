/**
 * What the archive register answers a workbook import with.
 *
 * Restated here rather than imported: the import is the register's own
 * operator tool and its schemas live in `apps/registry-stub/src/application`,
 * deliberately outside `@cadastre/api-contracts` (ADR-0011 §1). An app does not
 * import another app, so the surface that reads the report describes the shape
 * it reads — and that shape is pinned by the register's own schema, which is
 * where a change to it would start. See TECH_DEBT §10.
 */

/**
 * One thing the workbook said that the register could not store, and where it
 * said it. `row` is null when the problem is the sheet itself; `column` is null
 * when it is the row as a whole.
 */
export type ImportProblem = {
  sheet: string;
  row: number | null;
  column: string | null;
  message: string;
};

/** Child rows written, by sheet — what an operator counts against their file. */
export type ImportedRows = {
  addresses: number;
  rightHolders: number;
  documents: number;
  aliases: number;
  locations: number;
};

/** What the import did, whether or not it did all of it. */
export type RegistryImportReport = {
  /** True when every object in the workbook was stored. */
  accepted: boolean;
  imported: number;
  /** Objects the workbook named and the register did not store. */
  refused: number;
  rows: ImportedRows;
  problems: ImportProblem[];
  /** The register's audit line, written in English. */
  note: string;
};

/**
 * Where one import has got to. A modal that is opened, used and closed owns
 * this itself: nothing outside it reads the progress or the report, so putting
 * it in the store would be state with no second reader.
 */
export type ImportPhase =
  | { kind: 'idle' }
  /** `progress` is the transfer, 0–100; the register reads the file after it. */
  | { kind: 'sending'; progress: number }
  | { kind: 'reported'; report: RegistryImportReport }
  | { kind: 'failed'; message: string };
