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

/**
 * Which workbook the operator uploaded, and who worked that out.
 *
 * Two shapes reach the register (ADR-0012): its own six-sheet template, which
 * is recognised by the sheet named `Objects`, and one of the five files the
 * archive actually keeps, which is recognised from its sheet names and column
 * headers — by the register's own rule, or by a model reading the same shape.
 * `detectedBy` is which of the two decided, because an operator should never be
 * told a file is something on nobody's authority.
 */
export type ImportSource = {
  kind: 'Template' | 'ArchiveRegister';
  /** The catalogue id of the register — "EMDK", "Hovsan". Null for the template. */
  register: string | null;
  /** The file as the archive names it, so the operator can check it is the one they sent. */
  file: string | null;
  detectedBy: 'sheets' | 'fingerprint' | 'model';
  /** 0 to 1, as whoever decided means it. Null where nobody offered one. */
  confidence: number | null;
  reason: string;
  sheets: {
    name: string;
    rows: number;
    columns: { named: number; read: number };
  }[];
};

/** What the import did, whether or not it did all of it. */
export type RegistryImportReport = {
  /** True when every object in the workbook was stored. */
  accepted: boolean;
  source: ImportSource;
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
