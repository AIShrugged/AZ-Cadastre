/**
 * A spreadsheet, read as text and nothing else.
 *
 * Every column of the register's models is text on purpose (ADR-0010 §2) — the
 * sources hold `01-dən 30`, `2 (ики)` and `0,05 ha` where a schema written from
 * scratch would have put numbers — so the reader hands back what the cell says
 * and never what a spreadsheet library guesses it means. Which of those strings
 * is a year, an area or a page range is the import schema's question, and it is
 * asked once, in one place.
 */
export type SheetRow = {
  /**
   * The row number the sheet itself shows, header row included. A refusal is
   * only useful if the operator can open the file and look at the row it names.
   */
  readonly number: number;
  /** Cell by column header. A blank cell is `''`; a column the sheet has no header for is absent. */
  readonly cells: Readonly<Record<string, string>>;
};

export type SheetTable = {
  readonly name: string;
  readonly rows: readonly SheetRow[];
};

/** A file that is not a workbook this endpoint can read at all. */
export class WorkbookUnreadableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'WorkbookUnreadableError';
  }
}

export abstract class WorkbookReader {
  /**
   * Every sheet of the workbook, in the order it holds them.
   *
   * Throws {@link WorkbookUnreadableError} when the bytes are not a workbook.
   * A workbook whose *contents* are wrong is not this port's business: that is
   * an answer the import reports row by row, not a failure to read a file.
   */
  abstract read(bytes: Buffer): Promise<readonly SheetTable[]>;
}
