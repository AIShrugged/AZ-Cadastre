import { beforeEach, describe, expect, it } from 'vitest';

import { SilentLogger } from '@cadastre/logger';

import {
  RegistryWriter,
  WorkbookReader,
  WorkbookUnreadableError,
  type SheetTable,
} from './ports/index.js';
import type { ObjectImport } from './registry-import.schema.js';
import { RegistryImportService } from './registry-import.service.js';

const OFFICE = '1 saylı Bakı Ərazi İdarəsi';
const ZABRAT = '005013055966-10301';
const BUZOVNA = '003013067339-10301';
const ARCHIVE = 'Bakı Əİ arxivi';

/**
 * A sheet as the reader hands it over: the header row is already consumed, so
 * the first row of values is row 2 of the file — which is what a problem points
 * the operator at.
 */
function sheet(
  name: string,
  columns: readonly string[],
  rows: readonly (readonly string[])[],
): SheetTable {
  return {
    name,
    rows: rows.map((cells, index) => ({
      number: index + 2,
      cells: Object.fromEntries(
        columns.map((column, at) => [column, cells[at] ?? '']),
      ),
    })),
  };
}

const OBJECT_COLUMNS = [
  'registerNo',
  'territorialOffice',
  'sourceDatabase',
  'plotArea',
  'buildYear',
];

function objects(rows: readonly (readonly string[])[]): SheetTable {
  return sheet('Objects', OBJECT_COLUMNS, rows);
}

const BOTH_OBJECTS = objects([
  [ZABRAT, OFFICE, ARCHIVE, '0.04 ha'],
  [BUZOVNA, OFFICE, ARCHIVE, '0.0309 ha'],
]);

class StubReader extends WorkbookReader {
  constructor(private readonly sheets: readonly SheetTable[]) {
    super();
  }

  async read(): Promise<readonly SheetTable[]> {
    return this.sheets;
  }
}

class CapturingWriter extends RegistryWriter {
  written: ObjectImport[] = [];

  async upsert(objects: readonly ObjectImport[]): Promise<void> {
    this.written.push(...objects);
  }
}

function importing(sheets: readonly SheetTable[]): {
  service: RegistryImportService;
  writer: CapturingWriter;
} {
  const writer = new CapturingWriter();

  return {
    service: new RegistryImportService(
      new SilentLogger(),
      new StubReader(sheets),
      writer,
    ),
    writer,
  };
}

const NOTHING = Buffer.alloc(0);

describe('importing a workbook of register records', () => {
  let service: RegistryImportService;
  let writer: CapturingWriter;

  beforeEach(() => {
    ({ service, writer } = importing([BOTH_OBJECTS]));
  });

  it('stores every object the workbook carries', async () => {
    // act
    const report = await service.import(NOTHING);

    // assert
    expect(report).toMatchObject({ accepted: true, imported: 2, refused: 0 });
    expect(writer.written.map(one => one.object.registerNo)).toEqual([
      ZABRAT,
      BUZOVNA,
    ]);
  });

  it('keys an object by its office as well as its number', async () => {
    // act
    await service.import(NOTHING);

    // assert — the key is the pair, because a register number belongs to an
    // office and the same property holds one number at each (ADR-0010 §2)
    expect(writer.written[0]?.object).toMatchObject({
      registerNo: ZABRAT,
      territorialOffice: OFFICE,
    });
  });

  it('keeps an area as the source wrote it, unit and all', async () => {
    // act
    await service.import(NOTHING);

    // assert
    expect(writer.written[0]?.object.plotArea).toBe('0.04 ha');
  });

  it('leaves a column the source did not carry null rather than empty', async () => {
    // act
    await service.import(NOTHING);

    // assert — a column an area's register never kept is silence, not a value
    expect(writer.written[0]?.object.buildYear).toBeNull();
  });
});

describe('what it refuses', () => {
  it('reports the sheet, the row and the column of a missing key', async () => {
    // arrange
    const { service, writer } = importing([
      objects([
        [ZABRAT, OFFICE, ARCHIVE],
        ['', OFFICE, ARCHIVE],
      ]),
    ]);

    // act
    const report = await service.import(NOTHING);

    // assert
    expect(report.problems).toEqual([
      {
        sheet: 'Objects',
        row: 3,
        column: 'registerNo',
        message: 'must not be empty',
      },
    ]);
    expect(writer.written).toHaveLength(1);
  });

  /*
   * `buildYear` is the one column of the whole schema read as a number, and the
   * sources write "1984-cü il" in it. A year the import guessed at would be a
   * figure no paper states, so the row is refused instead.
   */
  it('refuses a build year that is not a year rather than coercing one', async () => {
    // arrange
    const { service, writer } = importing([
      objects([[ZABRAT, OFFICE, ARCHIVE, '0.04 ha', '1984-cü il']]),
    ]);

    // act
    const report = await service.import(NOTHING);

    // assert
    expect(report.problems[0]).toMatchObject({
      sheet: 'Objects',
      row: 2,
      column: 'buildYear',
    });
    expect(writer.written).toEqual([]);
  });

  it('names every column of a row that is wrong in more than one place', async () => {
    // arrange
    const { service } = importing([
      objects([['', OFFICE, '', '0.05 ha', '1984-cü il']]),
    ]);

    // act
    const report = await service.import(NOTHING);

    // assert
    expect(report.problems.map(problem => problem.column)).toEqual([
      'registerNo',
      'buildYear',
      'sourceDatabase',
    ]);
  });

  it('says which of the enumerated values it would have taken', async () => {
    // arrange
    const { service } = importing([
      BOTH_OBJECTS,
      sheet(
        'Addresses',
        ['registerNo', 'territorialOffice', 'kind', 'value'],
        [[ZABRAT, OFFICE, 'Köhnə', 'Zabrat qəsəbəsi']],
      ),
    ]);

    // act
    const report = await service.import(NOTHING);

    // assert
    expect(report.problems[0]).toEqual({
      sheet: 'Addresses',
      row: 2,
      column: 'kind',
      message: 'must be one of Current, Legacy or Register',
    });
  });

  /*
   * The whole of why an object is the unit of an import. Storing the object
   * without the address the workbook gave it would tell the operator the record
   * went in and never that a spelling did not — and a register that answers to
   * fewer addresses than it was told about is a register nobody can reach.
   */
  it('refuses the object whole when one of its rows is refused', async () => {
    // arrange
    const { service, writer } = importing([
      BOTH_OBJECTS,
      sheet(
        'RightHolders',
        ['registerNo', 'territorialOffice', 'name', 'kind'],
        [
          [ZABRAT, OFFICE, 'Rusadze Vera Vladimirovna', 'Individual'],
          [ZABRAT, OFFICE, 'Əliyev Elçin Vaqif oğlu', 'Şəxs'],
        ],
      ),
    ]);

    // act
    const report = await service.import(NOTHING);

    // assert
    expect(writer.written.map(one => one.object.registerNo)).toEqual([BUZOVNA]);
    expect(report).toMatchObject({ imported: 1, refused: 1 });
  });

  // One bad row is one object to fix, not a file to upload again — which is what
  // makes a load of the 55 register files recoverable.
  it('stores every other object in the file', async () => {
    // arrange
    const { service, writer } = importing([
      objects([
        [ZABRAT, OFFICE, ARCHIVE],
        ['', OFFICE, ARCHIVE],
        [BUZOVNA, OFFICE, ARCHIVE],
      ]),
    ]);

    // act
    await service.import(NOTHING);

    // assert
    expect(writer.written.map(one => one.object.registerNo)).toEqual([
      ZABRAT,
      BUZOVNA,
    ]);
  });

  // Which of the two rows is meant is not the register's to decide.
  it('refuses both rows when the workbook names one object twice', async () => {
    // arrange
    const { service, writer } = importing([
      objects([
        [ZABRAT, OFFICE, ARCHIVE],
        [ZABRAT, OFFICE, 'пасбаза'],
      ]),
    ]);

    // act
    const report = await service.import(NOTHING);

    // assert
    expect(writer.written).toEqual([]);
    expect(report.problems[0]).toMatchObject({ sheet: 'Objects', row: 3 });
  });

  it('refuses an object the workbook locates twice', async () => {
    // arrange
    const { service, writer } = importing([
      BOTH_OBJECTS,
      sheet(
        'Locations',
        ['registerNo', 'territorialOffice', 'folder', 'pages'],
        [
          [ZABRAT, OFFICE, '246', '01-dən 44'],
          [ZABRAT, OFFICE, '31', '49-dən 61'],
        ],
      ),
    ]);

    // act
    const report = await service.import(NOTHING);

    // assert
    expect(writer.written.map(one => one.object.registerNo)).toEqual([BUZOVNA]);
    expect(report.problems[0]).toMatchObject({ sheet: 'Locations', row: 3 });
  });

  it('reports a row that names an object the workbook does not carry', async () => {
    // arrange
    const { service } = importing([
      objects([[ZABRAT, OFFICE, ARCHIVE]]),
      sheet(
        'Documents',
        ['registerNo', 'territorialOffice', 'name', 'holding'],
        [[BUZOVNA, OFFICE, 'Ərizə', 'Held']],
      ),
    ]);

    // act
    const report = await service.import(NOTHING);

    // assert
    expect(report.problems[0]).toMatchObject({
      sheet: 'Documents',
      row: 2,
      column: null,
    });
  });

  // Once the object itself is refused, its rows have nothing to attach to. They
  // are not a second fault to report.
  it('does not report the rows of an object it already refused', async () => {
    // arrange
    const { service } = importing([
      objects([[ZABRAT, OFFICE, '']]),
      sheet(
        'Documents',
        ['registerNo', 'territorialOffice', 'name', 'holding'],
        [[ZABRAT, OFFICE, 'Ərizə', 'Held']],
      ),
    ]);

    // act
    const report = await service.import(NOTHING);

    // assert
    expect(report.problems).toHaveLength(1);
    expect(report.problems[0]?.sheet).toBe('Objects');
  });

  // The report is the answer whatever it says; only a file that is not a
  // workbook of register records at all is refused outright.
  it('refuses a workbook with no Objects sheet', async () => {
    // arrange
    const { service } = importing([
      sheet('Sheet1', ['ünvan'], [['Zabrat qəsəbəsi']]),
    ]);

    // act, assert
    await expect(service.import(NOTHING)).rejects.toBeInstanceOf(
      WorkbookUnreadableError,
    );
  });
});

describe('the rows that hang off an object', () => {
  const SHEETS = [
    BOTH_OBJECTS,
    sheet(
      'Addresses',
      ['registerNo', 'territorialOffice', 'kind', 'value', 'sourceDatabase'],
      [
        [ZABRAT, OFFICE, 'Current', 'Zabrat qəsəbəsi, giriş 95A'],
        [ZABRAT, OFFICE, 'Legacy', 'Zabrat qəsəbəsi', 'пасбаза'],
      ],
    ),
    sheet(
      'Documents',
      ['registerNo', 'territorialOffice', 'name', 'holding'],
      [
        [ZABRAT, OFFICE, 'Ərizə', 'Held'],
        [ZABRAT, OFFICE, 'Sərəncam çıxarışı', 'NotHeld'],
      ],
    ),
    sheet(
      'Aliases',
      ['registerNo', 'territorialOffice', 'kind', 'value'],
      [[ZABRAT, OFFICE, 'Inventory', '415']],
    ),
    sheet(
      'Locations',
      ['registerNo', 'territorialOffice', 'folder', 'pages'],
      [[ZABRAT, OFFICE, '246', '01-dən 44']],
    ),
  ];

  let service: RegistryImportService;
  let writer: CapturingWriter;

  beforeEach(() => {
    ({ service, writer } = importing(SHEETS));
  });

  it('hands them over under the object they name, in the order the sheet listed them', async () => {
    // act
    await service.import(NOTHING);

    // assert
    expect(writer.written[0]?.addresses.map(one => one.value)).toEqual([
      'Zabrat qəsəbəsi, giriş 95A',
      'Zabrat qəsəbəsi',
    ]);
  });

  it('strips the key columns it joined them by', async () => {
    // act
    await service.import(NOTHING);

    // assert — those two belong to the object, not to the row
    expect(writer.written[0]?.addresses[0]).not.toHaveProperty('registerNo');
  });

  /*
   * There are six of these registers, they overlap, and where they disagree
   * somebody has to be told which one said what (ADR-0010 §3). A sheet that left
   * the column blank was loading one register, not six.
   */
  it('takes the register a row came out of to be the object own when the sheet is silent', async () => {
    // act
    await service.import(NOTHING);

    // assert
    expect(writer.written[0]?.documents[0]?.sourceDatabase).toBe(ARCHIVE);
    expect(writer.written[0]?.aliases[0]?.sourceDatabase).toBe(ARCHIVE);
    expect(writer.written[0]?.location?.sourceDatabase).toBe(ARCHIVE);
  });

  it('keeps the register a row names when the sheet does say', async () => {
    // act
    await service.import(NOTHING);

    // assert
    expect(writer.written[0]?.addresses[1]?.sourceDatabase).toBe('пасбаза');
  });

  it('counts what it stored, sheet by sheet', async () => {
    // act
    const report = await service.import(NOTHING);

    // assert
    expect(report.rows).toEqual({
      addresses: 2,
      rightHolders: 0,
      documents: 2,
      aliases: 1,
      locations: 1,
    });
  });

  /*
   * Not a problem to report. A register that never recorded which papers it
   * holds is silent about them rather than in disagreement (ADR-0010 §5), and a
   * sheet the workbook does not carry is the same silence.
   */
  it('says nothing about a sheet the workbook does not carry', async () => {
    // act
    const report = await service.import(NOTHING);

    // assert
    expect(report.problems).toEqual([]);
    expect(writer.written[0]?.rightHolders).toEqual([]);
  });

  // The archive's own registers carry columns these models have no home for — a
  // clerk's note, a settlement's tally — and a file refused for one of those
  // would be a file nobody could load.
  it('ignores a column no model names', async () => {
    // arrange
    const { service, writer } = importing([
      sheet(
        'Objects',
        ['registerNo', 'territorialOffice', 'sourceDatabase', 'qeyd'],
        [[ZABRAT, OFFICE, ARCHIVE, 'kağız cırılıb']],
      ),
    ]);

    // act
    const report = await service.import(NOTHING);

    // assert
    expect(report.accepted).toBe(true);
    expect(writer.written[0]?.object).not.toHaveProperty('qeyd');
  });
});

describe('the report it answers with', () => {
  it('is accepted only when nothing at all was refused', async () => {
    // arrange
    const { service } = importing([
      objects([
        [ZABRAT, OFFICE, ARCHIVE],
        [BUZOVNA, OFFICE, ''],
      ]),
    ]);

    // act
    const report = await service.import(NOTHING);

    // assert
    expect(report).toMatchObject({ accepted: false, imported: 1, refused: 1 });
  });

  /*
   * Sheet, row and column, and never the value. Whoever uploaded the file can
   * open it at the row this names, and the register has no business copying
   * somebody's property data back out of a file it refused (ADR-0008).
   */
  it('never repeats what the refused cell said', async () => {
    // arrange
    const { service } = importing([
      objects([[ZABRAT, OFFICE, ARCHIVE, '0.04 ha', 'təxminən 1980']]),
    ]);

    // act
    const report = await service.import(NOTHING);

    // assert
    expect(JSON.stringify(report)).not.toContain('təxminən 1980');
  });

  it('says how many objects it read, stored and refused', async () => {
    // arrange
    const { service } = importing([
      objects([
        [ZABRAT, OFFICE, ARCHIVE],
        ['', OFFICE, ARCHIVE],
      ]),
    ]);

    // act
    const report = await service.import(NOTHING);

    // assert
    expect(report.note).toContain('2 objects read');
    expect(report.note).toContain('1 stored');
    expect(report.note).toContain('1 refused');
  });
});
