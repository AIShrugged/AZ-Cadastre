import { Inject, Injectable } from '@nestjs/common';
import type { z } from 'zod';

import { Logger } from '@cadastre/logger';

import {
  registerNamed,
  shapeOf,
  tableOf,
  type ArchiveRegister,
  type SheetRow,
  type SheetTable,
} from '../domain/index.js';

import { objectsFromSheet } from './native-register.mapping.js';
import {
  RegistryWriter,
  WorkbookClassifier,
  WorkbookReader,
  WorkbookUnreadableError,
} from './ports/index.js';
import {
  AddressRowSchema,
  AliasRowSchema,
  DocumentRowSchema,
  LocationRowSchema,
  ObjectKeySchema,
  ObjectRowSchema,
  RightHolderRowSchema,
  SHEETS,
  type AddressImport,
  type AliasImport,
  type DocumentImport,
  type ImportProblem,
  type ObjectImport,
  type ObjectKey,
  type ObjectRow,
  type RegistryImportReport,
  type RegistryImportSource,
  type RightHolderImport,
} from './registry-import.schema.js';

/**
 * Loads a workbook of register records into the register's own database.
 *
 * It is not part of what the register answers. `ArchiveRegistryApi` is what a
 * caller verifying a submission may ask; this is the operator's side of the same
 * system — how the archive registers get in, which today is by hand and tomorrow
 * is by whatever ingests the 55 files. That is why it is stub-local and not in
 * `@cadastre/api-contracts` (ADR-0011).
 *
 * Two workbooks arrive here and it decides which it is holding (ADR-0012). One
 * is the register's own template — a sheet per model, joined on the object key —
 * and it is recognised by the sheet named `Objects`, because nothing else has
 * one. The other is one of the six files the archive actually keeps, in the
 * shape the office that wrote it chose thirty years ago; those are recognised
 * from their sheet names and column headers, and what a column means is the
 * lexicon's answer, given once for all six.
 *
 * What it refuses, it refuses whole. The unit of an import is an object with the
 * rows that hang off it, so a bad address row refuses the object rather than
 * storing it without the address: a register holding a record it had been told
 * more about than it stored is worse than one holding nothing. Every other
 * object in the file still goes in, which is what makes a 55-file load
 * recoverable — one bad row is one object to fix, not a file to upload again.
 */
@Injectable()
export class RegistryImportService {
  private readonly logger: Logger;

  constructor(
    @Inject(Logger) logger: Logger,
    @Inject(WorkbookReader) private readonly workbooks: WorkbookReader,
    @Inject(WorkbookClassifier) private readonly classifier: WorkbookClassifier,
    @Inject(RegistryWriter) private readonly writer: RegistryWriter,
  ) {
    this.logger = logger.child({ scope: RegistryImportService.name });
  }

  async import(bytes: Buffer): Promise<RegistryImportReport> {
    const tables = (await this.workbooks.read(bytes)).map(tableOf);
    const collated = sheetNamed(tables, SHEETS.objects)
      ? fromTemplate(tables)
      : await this.fromArchiveRegister(tables);

    if (collated.objects.length > 0) await this.writer.upsert(collated.objects);

    const { objects, problems, read, rows, source } = collated;
    const report: RegistryImportReport = {
      accepted: problems.length === 0,
      source,
      imported: objects.length,
      refused: read - objects.length,
      rows,
      problems: [...problems],
      note: noteFor(read, objects.length, problems.length),
    };

    // Where the workbook is wrong, never what it says there. The cells are
    // somebody's property data, and a refusal that quoted them would put them in
    // a log the register has no reason to hold them in (ADR-0008).
    this.logger.log('Register records imported', {
      accepted: report.accepted,
      register: source.register,
      detectedBy: source.detectedBy,
      confidence: source.confidence,
      imported: report.imported,
      refused: report.refused,
      rows: report.rows,
      problems: problems.map(problem => ({
        sheet: problem.sheet,
        row: problem.row,
        column: problem.column,
      })),
    });

    return report;
  }

  /**
   * The archive's own file, once somebody has said which of the six it is.
   *
   * The classifier is shown the shape — sheet names and header rows — and never
   * a record: recognising a file does not need anybody's property data, and
   * sending it to a provider to be told what file this is would be sending it
   * for nothing (ADR-0008).
   */
  private async fromArchiveRegister(
    tables: readonly SheetTable[],
  ): Promise<Collated> {
    const answer = await this.classifier.classify(shapeOf(tables));
    const register = answer.register ? registerNamed(answer.register) : null;

    // Not a refusal reported row by row: a workbook that is neither the
    // register's own template nor one of the six files the archive keeps is
    // not a workbook of register records, and there is nothing in it to report
    // against.
    if (!register) {
      throw new WorkbookUnreadableError(
        'The workbook is neither the register import template — which carries a ' +
          `"${SHEETS.objects}" sheet — nor one of the archive registers the ` +
          `register knows how to read. ${answer.reason} It carries ` +
          (tables.length === 0
            ? 'no sheets at all.'
            : `${tables.map(table => `"${table.name}"`).join(', ')}.`),
      );
    }

    return collateNative(register, tables, answer);
  }
}

function noteFor(read: number, imported: number, problems: number): string {
  const objects =
    `${many(read, 'object')} read from the workbook, ${imported} stored, ` +
    `${read - imported} refused.`;

  return problems === 0
    ? `${objects} Every row it carried was stored.`
    : `${objects} ${many(problems, 'problem')} listed against the sheet, row ` +
        'and column it was found at; the values are in the file you uploaded.';
}

function many(count: number, noun: string): string {
  return count === 1 ? `1 ${noun}` : `${count} ${noun}s`;
}

type Collated = {
  readonly objects: readonly ObjectImport[];
  readonly problems: readonly ImportProblem[];
  /** Object rows the workbook carried, stored or not. */
  readonly read: number;
  readonly rows: RegistryImportReport['rows'];
  readonly source: RegistryImportSource;
};

/**
 * One of the archive's own six files, sheet by sheet.
 *
 * Every sheet of it is read the same way, because the question "what does this
 * column mean" has the same answer in all forty of them. What differs is the
 * register: whose numbering its numbers are, and what kind of paper a row of it
 * records — and that is a catalogue entry (ADR-0012 §2).
 */
function collateNative(
  register: ArchiveRegister,
  tables: readonly SheetTable[],
  answer: { confidence: number | null; reason: string; by: 'fingerprint' | 'model' }, // prettier-ignore
): Collated {
  const objects: ObjectImport[] = [];
  const problems: ImportProblem[] = [];
  const sheets: RegistryImportSource['sheets'] = [];
  let read = 0;

  for (const table of tables) {
    const result = objectsFromSheet(register, table);

    sheets.push({
      name: table.name,
      rows: result.skipped ? 0 : result.read,
      columns: result.columns,
    });

    if (result.skipped) continue;

    objects.push(...result.objects);
    problems.push(...result.problems);
    read += result.read;
  }

  return {
    objects,
    problems,
    // What the file carried, so that a row the register merged into an object it
    // already had is visible as the difference between the two.
    read: Math.max(read, objects.length),
    rows: countRows(objects),
    source: {
      kind: 'ArchiveRegister',
      register: register.id,
      file: register.file,
      detectedBy: answer.by,
      confidence: answer.confidence,
      reason: answer.reason,
      sheets,
    },
  };
}

/**
 * The register's own template: a sheet per model, joined on the object key.
 *
 * Written as a function rather than a method for the same reason it always was:
 * what a workbook says is decided before anything is written, and the decision
 * is worth reading on its own.
 */
function fromTemplate(sheets: readonly SheetTable[]): Collated {
  const problems: ImportProblem[] = [];
  // The caller only reaches here having found it, so this is the type narrowing
  // and not a check.
  const objectSheet = sheetNamed(sheets, SHEETS.objects) as SheetTable;

  const objects = new Map<string, { row: number; object: ObjectRow }>();
  // An object the register will not store, for any reason. Its child rows are
  // then skipped rather than reported a second time as belonging to nothing.
  const refused = new Set<string>();

  for (const row of objectSheet.rows) {
    const parsed = ObjectRowSchema.safeParse(row.cells);

    if (!parsed.success) {
      problems.push(...problemsIn(objectSheet.name, row, parsed.error));
      const key = keyIn(row);
      if (key) refused.add(key);
      continue;
    }

    const key = keyOf(parsed.data);
    const first = objects.get(key);

    if (first || refused.has(key)) {
      // The workbook contradicts itself about one object, and which of the rows
      // is meant is not the register's to decide. Both are refused.
      problems.push({
        sheet: objectSheet.name,
        row: row.number,
        column: null,
        message: first
          ? `a second row for the object first named on row ${first.row}; ` +
            'the register cannot say which of them is meant'
          : 'another row for this object was already refused',
      });
      objects.delete(key);
      refused.add(key);
      continue;
    }

    objects.set(key, { row: row.number, object: parsed.data });
  }

  const addresses = childRows(sheets, SHEETS.addresses, AddressRowSchema, problems, refused); // prettier-ignore
  const rightHolders = childRows(sheets, SHEETS.rightHolders, RightHolderRowSchema, problems, refused); // prettier-ignore
  const documents = childRows(sheets, SHEETS.documents, DocumentRowSchema, problems, refused); // prettier-ignore
  const aliases = childRows(sheets, SHEETS.aliases, AliasRowSchema, problems, refused); // prettier-ignore
  const locations = childRows(sheets, SHEETS.locations, LocationRowSchema, problems, refused); // prettier-ignore

  for (const [key, held] of locations.entries()) {
    const second = held[1];

    // ArchiveLocation is one row per object — the folder the case itself sits
    // in. Two of them is the contradiction a duplicated object row is.
    if (second) {
      problems.push({
        sheet: SHEETS.locations,
        row: second.row,
        column: null,
        message: `a second location for the object already located on row ${held[0]?.row}`,
      });
      refused.add(key);
    }
  }

  reportOrphans(addresses, SHEETS.addresses, objects, refused, problems);
  reportOrphans(rightHolders, SHEETS.rightHolders, objects, refused, problems);
  reportOrphans(documents, SHEETS.documents, objects, refused, problems);
  reportOrphans(aliases, SHEETS.aliases, objects, refused, problems);
  reportOrphans(locations, SHEETS.locations, objects, refused, problems);

  const imports: ObjectImport[] = [];

  for (const [key, held] of objects.entries()) {
    if (refused.has(key)) continue;

    const { object } = held;
    const location = locations.get(key)?.[0]?.data ?? null;

    imports.push({
      object,
      addresses: (addresses.get(key) ?? []).map(({ data }): AddressImport =>
        keyless(data),
      ),
      rightHolders: (rightHolders.get(key) ?? []).map(
        ({ data }): RightHolderImport => keyless(data),
      ),
      // The register a child row came out of is the object's own unless the
      // sheet said otherwise, exactly as the seed writes them: a workbook that
      // left the column blank was loading one register, not six.
      documents: (documents.get(key) ?? []).map(({ data }): DocumentImport => ({
        ...keyless(data),
        sourceDatabase: data.sourceDatabase ?? object.sourceDatabase,
      })),
      aliases: (aliases.get(key) ?? []).map(({ data }): AliasImport => ({
        ...keyless(data),
        sourceDatabase: data.sourceDatabase ?? object.sourceDatabase,
      })),
      location: location
        ? {
            ...keyless(location),
            sourceDatabase: location.sourceDatabase ?? object.sourceDatabase,
          }
        : null,
    });
  }

  return {
    objects: imports,
    problems,
    read: objectSheet.rows.length,
    rows: countRows(imports),
    source: {
      kind: 'Template',
      register: null,
      file: null,
      // By the sheets and by nothing else: no other workbook carries `Objects`,
      // so no model is asked a question that is already answered.
      detectedBy: 'sheets',
      confidence: null,
      reason: `The workbook carries an "${SHEETS.objects}" sheet, which only the register's own import template does.`, // prettier-ignore
      sheets: sheets.map(sheet => ({
        name: sheet.name,
        rows: sheet.rows.length,
        columns: {
          named: sheet.headers[0]?.filter(header => header.trim() !== '').length ?? 0, // prettier-ignore
          read: sheet.headers[0]?.filter(header => header.trim() !== '').length ?? 0, // prettier-ignore
        },
      })),
    },
  };
}

/** What was written under the objects, by sheet — what an operator counts against their file. */
function countRows(
  objects: readonly ObjectImport[],
): RegistryImportReport['rows'] {
  // prettier-ignore
  return {
    addresses: objects.reduce((sum, one) => sum + one.addresses.length, 0),
    rightHolders: objects.reduce((sum, one) => sum + one.rightHolders.length, 0), // prettier-ignore
    documents: objects.reduce((sum, one) => sum + one.documents.length, 0),
    aliases: objects.reduce((sum, one) => sum + one.aliases.length, 0),
    locations: objects.filter(one => one.location !== null).length,
  };
}

/** A child row once it has been read: the row it was on and what it said. */
type Held<T> = { readonly row: number; readonly data: T };

/**
 * Structurally what a row schema is used for here, rather than `z.ZodType`: the
 * schemas preprocess their input, so their declared input type is `unknown` and
 * naming it would say less than this does.
 */
type RowSchema<T> = {
  safeParse(
    value: unknown,
  ): { success: true; data: T } | { success: false; error: z.ZodError };
};

/**
 * Every row of a child sheet, grouped under the object it names.
 *
 * A row the schema refuses takes its object down with it. The alternative is to
 * store the object without that row, which is the one thing an import must not
 * do: the operator would be told the object went in and never that a right
 * holder did not.
 */
function childRows<T extends ObjectKey>(
  sheets: readonly SheetTable[],
  name: string,
  schema: RowSchema<T>,
  problems: ImportProblem[],
  refused: Set<string>,
): Map<string, Held<T>[]> {
  const grouped = new Map<string, Held<T>[]>();
  const sheet = sheetNamed(sheets, name);

  // A sheet the workbook does not carry says nothing about the objects in it. A
  // register that never recorded which papers it holds is silent about them and
  // not in disagreement (ADR-0010 §5); a missing sheet is the same silence.
  if (!sheet) return grouped;

  for (const row of sheet.rows) {
    const parsed = schema.safeParse(row.cells);

    if (!parsed.success) {
      problems.push(...problemsIn(sheet.name, row, parsed.error));
      const key = keyIn(row);
      if (key) refused.add(key);
      continue;
    }

    const key = keyOf(parsed.data);
    const held = grouped.get(key);

    if (held) held.push({ row: row.number, data: parsed.data });
    else grouped.set(key, [{ row: row.number, data: parsed.data }]);
  }

  return grouped;
}

/** A child row naming an object no `Objects` row carries is a row nothing can be done with. */
function reportOrphans<T>(
  grouped: ReadonlyMap<string, readonly Held<T>[]>,
  sheet: string,
  objects: ReadonlyMap<string, unknown>,
  refused: ReadonlySet<string>,
  problems: ImportProblem[],
): void {
  for (const [key, held] of grouped.entries()) {
    if (objects.has(key) || refused.has(key)) continue;

    for (const row of held) {
      problems.push({
        sheet,
        row: row.row,
        column: null,
        message: `names an object the "${SHEETS.objects}" sheet does not carry`,
      });
    }
  }
}

function sheetNamed(
  sheets: readonly SheetTable[],
  name: string,
): SheetTable | undefined {
  // Case-insensitively: an operator who saved the template with the sheet named
  // `objects` has a typo, not a different file.
  return sheets.find(
    sheet => sheet.name.trim().toLowerCase() === name.toLowerCase(),
  );
}

function problemsIn(
  sheet: string,
  row: SheetRow,
  error: z.ZodError,
): ImportProblem[] {
  return error.issues.map(issue => ({
    sheet,
    row: row.number,
    // The first segment of the path is the column; these schemas are flat, so
    // there is never a second.
    column: issue.path.length > 0 ? String(issue.path[0]) : null,
    message: issue.message,
  }));
}

/**
 * The object key as one string, for grouping only.
 *
 * Through JSON rather than by joining on a separator: an office called `A` with
 * register `B-C` and one called `A-B` with register `C` are different objects,
 * and any separator that can occur in a value would merge them.
 */
function keyOf(key: ObjectKey): string {
  return JSON.stringify([key.territorialOffice, key.registerNo]);
}

/** The key of a row its own schema refused, when it carried one at all. */
function keyIn(row: SheetRow): string | null {
  const parsed = ObjectKeySchema.safeParse(row.cells);

  return parsed.success ? keyOf(parsed.data) : null;
}

/** A child row without the columns it was joined by: those are the object's, not its own. */
function keyless<T extends ObjectKey>(row: T): Omit<T, keyof ObjectKey> {
  const { registerNo: _registerNo, territorialOffice: _office, ...rest } = row;

  return rest;
}
