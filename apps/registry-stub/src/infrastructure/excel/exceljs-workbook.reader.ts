import { Injectable } from '@nestjs/common';
import ExcelJS, { type CellValue, type Worksheet } from 'exceljs';

import {
  WorkbookReader,
  WorkbookUnreadableError,
} from '../../application/ports/index.js';
import type { GridRow, SheetGrid } from '../../domain/index.js';

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
 * It makes no judgement at all, not even about which row is the header. Five of
 * the archive's files document themselves in their first four rows and one puts
 * a merged title above that; deciding what that means is knowledge about those
 * files and not about the format, so it lives in `domain/services/sheet-layout`
 * where it can be read and tested with no spreadsheet library in the room
 * (ADR-0012).
 */
@Injectable()
export class ExcelJsWorkbookReader extends WorkbookReader {
  async read(bytes: Buffer): Promise<readonly SheetGrid[]> {
    const workbook = new ExcelJS.Workbook();

    try {
      await workbook.xlsx.load(asArrayBuffer(bytes));
    } catch (cause) {
      throw new WorkbookUnreadableError(
        'The uploaded file could not be read as an .xlsx workbook.',
        { cause },
      );
    }

    const grids: SheetGrid[] = [];

    workbook.eachSheet(sheet => {
      grids.push(gridOf(sheet));
    });

    return grids;
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

function gridOf(sheet: Worksheet): SheetGrid {
  const rows: GridRow[] = [];

  sheet.eachRow({ includeEmpty: false }, (row, number) => {
    const cells: string[] = [];

    // By column index and not by cell, because `eachCell` skips the blanks and
    // a column that shifted left is a row read into the wrong fields. Every one
    // of the archive's files has a sheet with a hole in the middle of it.
    for (let column = 1; column <= sheet.columnCount; column++) {
      cells.push(textOf(row.getCell(column).value));
    }

    rows.push({ number, cells });
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
