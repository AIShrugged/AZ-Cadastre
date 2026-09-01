import { Injectable } from '@nestjs/common';
import ExcelJS, { type CellValue, type Worksheet } from 'exceljs';

import {
  WorkbookReader,
  WorkbookUnreadableError,
  type SheetRow,
  type SheetTable,
} from '../../application/ports/index.js';

/**
 * Reads an `.xlsx` workbook with ExcelJS, and hands every cell back as text.
 *
 * Text and not what the spreadsheet thinks the cell means, because the register
 * stores text: `registerNo` "003013067339-10301" is a string whose leading zero
 * is significant, `floors` is "2 (ики)", `plotArea` is "0,05 ha" and `pages` is
 * "01-dən 30" (ADR-0010 §2). A reader that handed back numbers would put the
 * first back as 3013067339 and lose the leading zero on the way in — which is
 * how some of the archive's own registers lost it.
 *
 * The only judgement it makes is which row is the header: the first, and its
 * cells are the column names the schemas are written against.
 */
@Injectable()
export class ExcelJsWorkbookReader extends WorkbookReader {
  async read(bytes: Buffer): Promise<readonly SheetTable[]> {
    const workbook = new ExcelJS.Workbook();

    try {
      await workbook.xlsx.load(asArrayBuffer(bytes));
    } catch (cause) {
      throw new WorkbookUnreadableError(
        'The uploaded file could not be read as an .xlsx workbook.',
        { cause },
      );
    }

    const tables: SheetTable[] = [];

    workbook.eachSheet(sheet => {
      tables.push(tableOf(sheet));
    });

    return tables;
  }
}

/**
 * ExcelJS declares the bytes it loads as an ArrayBuffer, which a Node Buffer is
 * a view over rather than an instance of. It is copied into one rather than cast
 * into one: multer's buffer is a slice of a pooled allocation, so handing over
 * its backing store would hand over more than the file.
 */
function asArrayBuffer(bytes: Buffer): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);

  new Uint8Array(copy).set(bytes);

  return copy;
}

function tableOf(sheet: Worksheet): SheetTable {
  const headers = new Map<number, string>();

  sheet.getRow(1).eachCell({ includeEmpty: false }, (cell, column) => {
    const header = textOf(cell.value);

    // A column with no header is a column no schema can name, so it is not read.
    // It is where a clerk's tally or a colour key usually sits.
    if (header !== '') headers.set(column, header);
  });

  const rows: SheetRow[] = [];

  sheet.eachRow({ includeEmpty: false }, (row, number) => {
    if (number === 1) return;

    const cells: Record<string, string> = {};
    let written = false;

    for (const [column, header] of headers.entries()) {
      const text = textOf(row.getCell(column).value);

      cells[header] = text;
      if (text !== '') written = true;
    }

    // A row with nothing in any named column is the spreadsheet's own padding —
    // formatting carried past the last record, which every one of these files
    // has. Reporting it as a record with no register number would fill the
    // report with problems nobody wrote.
    if (written) rows.push({ number, cells });
  });

  return { name: sheet.name, rows };
}

/** What the cell says, as the register would store it. */
function textOf(value: CellValue): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Date) return asWritten(value);

  if (typeof value === 'object') {
    if ('richText' in value) {
      return value.richText
        .map(part => part.text)
        .join('')
        .trim();
    }
    // A formula cell is worth what it computed; a hyperlink is worth its text.
    if ('result' in value) return textOf(value.result ?? null);
    if ('text' in value) return String(value.text).trim();
    // `#REF!`, `#N/A`. Handed on rather than blanked: a broken formula is
    // something the operator has to see in the report, and a cell read as empty
    // would be reported as a column they left out.
    if ('error' in value) return String(value.error);
  }

  return '';
}

/**
 * A date cell in the register's own way of writing one — `15.04.1999`.
 *
 * The sources write their dates as text in exactly this form, and every date
 * column of the models is a string for that reason. A cell somebody typed as a
 * real date still has to arrive as the register spells it, and in UTC, because
 * ExcelJS reads the serial number as a UTC instant and a local-time rendering
 * would move half of them a day.
 */
function asWritten(date: Date): string {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');

  return `${day}.${month}.${date.getUTCFullYear()}`;
}
