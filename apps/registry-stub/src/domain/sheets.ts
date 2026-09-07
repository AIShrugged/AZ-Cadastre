/**
 * A spreadsheet as the register reads one: text, by row and column, and no
 * opinion about what any of it means.
 *
 * The grid is what a workbook reader hands over. Which of its rows are headers,
 * which are the sheet's own documentation and which are records is a question
 * about the archive's files and not about the file format, so it is answered in
 * `services/sheet-layout.ts` and not in the adapter (ADR-0012).
 */

/** One sheet, exactly as its cells read. */
export type SheetGrid = {
  readonly name: string;
  readonly rows: readonly GridRow[];
};

export type GridRow = {
  /** The row number the sheet itself shows. A refusal is only useful if it can be opened at. */
  readonly number: number;
  /** By column index from 0. A blank cell is `''`; trailing blanks may be absent. */
  readonly cells: readonly string[];
};

export type SheetRow = {
  readonly number: number;
  /** By column index, aligned with `SheetTable.headers`. */
  readonly values: readonly string[];
  /**
   * By the sheet's primary header. A blank cell is `''`; a column the sheet has
   * no header for is absent. This is the view the workbook of the register's own
   * models is read through, where every column is named once and in English.
   */
  readonly cells: Readonly<Record<string, string>>;
};

export type SheetTable = {
  readonly name: string;
  /**
   * Every header row the sheet carries, in the order it carries them, each by
   * column index. The archive's own files head a column twice — in the office's
   * Azerbaijani and again in English — and both are needed: a bare `№` means a
   * row number in one register and a state act number in the next, and only the
   * English header says which.
   */
  readonly headers: readonly (readonly string[])[];
  readonly rows: readonly SheetRow[];
};

/** The shape of a workbook with none of its data: what a classifier is shown. */
export type WorkbookShape = {
  readonly sheets: readonly {
    readonly name: string;
    readonly headers: readonly (readonly string[])[];
    readonly rows: number;
  }[];
};

export function shapeOf(tables: readonly SheetTable[]): WorkbookShape {
  return {
    sheets: tables.map(table => ({
      name: table.name,
      headers: table.headers,
      rows: table.rows.length,
    })),
  };
}
