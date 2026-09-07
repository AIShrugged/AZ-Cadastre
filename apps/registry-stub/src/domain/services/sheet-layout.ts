/**
 * Which rows of a sheet are headers, which are its own documentation and which
 * are records.
 *
 * The archive's files come in two layouts and this is the only place that knows
 * it. A workbook of the register's own models is a header row and then records.
 * The six registers the customer stores are documented in the sheet itself:
 * column A labels the row — `Column Headers (Azerbaijani)`, `Column Headers
 * (English)`, `Column Descriptions (English)`, `Example Row` — and the records
 * sit under all four with column A empty. Some sheets carry a merged title
 * across the whole first row above that, and one carries a note beginning `⚠`
 * about group headings inside its data.
 *
 * Reading the second layout as if it were the first would take the Azerbaijani
 * header row as the records and the English one as a record too. The rule is
 * therefore stated once, here, where it can be read and tested without a
 * spreadsheet library — the reader's only job is text (ADR-0012).
 */
import type { GridRow, SheetGrid, SheetRow, SheetTable } from '../sheets.js';

/**
 * What column A of a documented sheet says about its row. Matched on the start
 * of the label because the files vary in what they put after it.
 */
const LABELS: readonly { readonly test: RegExp; readonly header: boolean }[] = [
  { test: /^column headers/i, header: true },
  { test: /^column descriptions/i, header: false },
  { test: /^example row/i, header: false },
  { test: /^⚠/u, header: false },
  { test: /^structural note/i, header: false },
  // The merged title row of the sale-contract sheets: the same sentence
  // repeated across every column of row 1, above the real headers.
  { test: /^information on /i, header: false },
];

function labelOf(row: GridRow): (typeof LABELS)[number] | null {
  const first = row.cells[0]?.trim() ?? '';

  return LABELS.find(label => label.test.test(first)) ?? null;
}

/**
 * The sheet, read.
 *
 * A documented sheet's header rows are the ones column A calls headers, and
 * every labelled row is the sheet talking about itself rather than a record. An
 * undocumented sheet has one header row — the first — which is what a workbook
 * of the register's own models is.
 */
export function tableOf(grid: SheetGrid): SheetTable {
  const documented = grid.rows.some(row => labelOf(row) !== null);
  const headers: string[][] = [];
  const body: GridRow[] = [];

  for (const row of grid.rows) {
    if (!documented) {
      if (headers.length === 0) headers.push([...row.cells]);
      else body.push(row);
      continue;
    }

    const label = labelOf(row);

    if (label?.header) headers.push([...row.cells]);
    else if (!label) body.push(row);
  }

  const primary = headers[0] ?? [];
  const named = new Map<number, string>();

  for (const [index, header] of primary.entries()) {
    const name = header.trim();

    // A column with no header is a column no schema can name, so it is not read
    // through `cells`. It is where a clerk's tally or a colour key usually sits
    // — and, in a documented sheet, where the label column is.
    if (name !== '') named.set(index, name);
  }

  const width = headers.reduce((most, row) => Math.max(most, row.length), 0);
  const rows: SheetRow[] = [];

  for (const row of body) {
    const values = Array.from(
      { length: Math.max(width, row.cells.length) },
      (_, index) => row.cells[index] ?? '',
    );
    const cells: Record<string, string> = {};

    for (const [index, name] of named.entries())
      cells[name] = values[index] ?? '';

    // A row with nothing in any column is the spreadsheet's own padding —
    // formatting carried past the last record, which every one of these files
    // has. Reporting it as a record with no register number would fill the
    // report with problems nobody wrote.
    if (values.some(value => value.trim() !== '')) {
      rows.push({ number: row.number, values, cells });
    }
  }

  return { name: grid.name, headers, rows };
}
