/**
 * Writes one archive-register fixture: the customer's own workbook, with
 * records under its own documentation.
 *
 * The six files as shipped are schema sheets. Every one of them documents
 * itself in its first rows — the office's Azerbaijani headers, an English
 * translation, a description of each column, one example row — and then stops,
 * because what the customer sent was the *shape* of each register and not its
 * contents.
 *
 * A fixture is therefore built from the customer's file rather than written out
 * by hand: the source workbook is opened, every row the sheet labels as its own
 * documentation is kept, the example row is dropped, and the records are
 * written under it with the label column left blank. If the office sends a
 * corrected schema, re-running picks it up and no fixture can drift from the
 * file it claims to be.
 *
 * Shared by `build-archive-fixtures.mjs`, which puts the archive's own rows
 * back into all six, and `build-case-fixtures.mjs`, which writes the two
 * customer cases into the one register that can hold them.
 */
import path from 'node:path';

import ExcelJS from 'exceljs';

/** The customer's own files, from this module's place in the repository. */
export const SOURCES = path.join(
  import.meta.dirname,
  '..',
  '..',
  '..',
  '..',
  'Fedor Zhernovoy',
);

/** What column A of a documented sheet says. Anything else is a record. */
const LABEL = /^(column headers|column descriptions|example row|⚠|structural note|information on )/iu; // prettier-ignore
const HEADER_LABEL = /^column headers/i;

/**
 * A header as the records name it. The office typed one of them across two
 * lines, and a line break inside a header is not a different column — the
 * lexicon folds every non-letter out of a header for the same reason.
 */
function norm(header) {
  return header.replaceAll(/\s+/gu, ' ').trim();
}

/** What a cell says, the way the reader reads one. */
export function textOf(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if (value.richText) return value.richText.map(part => part.text).join('');
    if (value.result !== undefined) return textOf(value.result);
    if (value.text !== undefined) return String(value.text);
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return '';
  }

  return String(value);
}

/**
 * Builds `target` from `source`, placing `rowsBySheet` under the headers of the
 * sheets that name them. Answers where it wrote and how many records it placed.
 */
export async function buildRegisterFixture({ source, target, rowsBySheet, out }) {
  const read = new ExcelJS.Workbook();

  await read.xlsx.readFile(path.join(SOURCES, source));

  const written = new ExcelJS.Workbook();
  let records = 0;

  read.eachSheet(sheet => {
    const sheetOut = written.addWorksheet(sheet.name);
    const width = sheet.columnCount;
    let headers = null;

    for (let number = 1; number <= sheet.rowCount; number++) {
      const row = sheet.getRow(number);
      const cells = Array.from({ length: width }, (_, at) =>
        textOf(row.getCell(at + 1).value).trim(),
      );
      const first = cells[0] ?? '';

      // The sheet's own documentation, carried over exactly — except the
      // example row, which is an illustration and in one sheet is not even
      // aligned with the headers above it.
      if (!LABEL.test(first)) continue;
      if (/^example row/i.test(first)) continue;

      sheetOut.addRow(cells);
      if (HEADER_LABEL.test(first) && !headers) headers = cells;
    }

    const rows = rowsBySheet[sheet.name] ?? [];

    if (rows.length === 0) return;

    if (!headers) {
      throw new Error(
        `"${source}" sheet "${sheet.name}" has no header row to place records against.`,
      );
    }

    for (const record of rows) {
      for (const named of Object.keys(record)) {
        if (!headers.some(header => norm(header) === norm(named))) {
          throw new Error(
            `"${source}" sheet "${sheet.name}" has no column "${named}". ` +
              `It heads: ${headers.filter(one => one !== '').map(norm).join(', ')}.`,
          );
        }
      }

      // Column A stays blank: it is the label column, and a record is not a
      // label. Everything else goes under the header that names it.
      const at = new Map(Object.entries(record).map(([named, value]) => [norm(named), value])); // prettier-ignore

      sheetOut.addRow(headers.map((header, column) => (column === 0 ? '' : at.get(norm(header)) ?? ''))); // prettier-ignore
      records++;
    }
  });

  const file = path.join(out, target);

  await written.xlsx.writeFile(file);

  return { file, records };
}
