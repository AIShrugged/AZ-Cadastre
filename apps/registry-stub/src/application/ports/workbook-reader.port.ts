import type { SheetGrid } from '../../domain/index.js';

export type { GridRow, SheetGrid, SheetRow, SheetTable } from '../../domain/index.js'; // prettier-ignore

/** A file that is not a workbook this endpoint can read at all. */
export class WorkbookUnreadableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'WorkbookUnreadableError';
  }
}

/**
 * A spreadsheet, read as text and nothing else.
 *
 * Every column of the register's models is text on purpose (ADR-0010 §2) — the
 * sources hold `01-dən 30`, `2 (ики)` and `0,05 ha` where a schema written from
 * scratch would have put numbers — so the reader hands back what the cell says
 * and never what a spreadsheet library guesses it means. Which of those strings
 * is a year, an area or a page range is the import schema's question, and it is
 * asked once, in one place.
 *
 * It hands back a grid and makes no judgement at all, not even about which row
 * is the header. That judgement is about the archive's own files, which
 * document themselves in their first four rows and one of which puts a merged
 * title above that — and it belongs with the rest of what is known about those
 * files, in `domain/services/sheet-layout.ts`, where it can be read and tested
 * without a spreadsheet library (ADR-0012).
 */
export abstract class WorkbookReader {
  /**
   * Every sheet of the workbook, in the order it holds them.
   *
   * Throws {@link WorkbookUnreadableError} when the bytes are not a workbook.
   * A workbook whose *contents* are wrong is not this port's business: that is
   * an answer the import reports row by row, not a failure to read a file.
   */
  abstract read(bytes: Buffer): Promise<readonly SheetGrid[]>;
}
