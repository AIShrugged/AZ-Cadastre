import ExcelJS, { type CellValue } from 'exceljs';
import { describe, expect, it } from 'vitest';

import { WorkbookUnreadableError } from '../../application/ports/index.js';

import { ExcelJsWorkbookReader } from './exceljs-workbook.reader.js';

async function workbookOf(
  sheets: readonly { name: string; rows: readonly CellValue[][] }[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();

  for (const sheet of sheets) {
    const worksheet = workbook.addWorksheet(sheet.name);

    for (const row of sheet.rows) worksheet.addRow([...row]);
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

const reader = new ExcelJsWorkbookReader();

describe('reading a workbook', () => {
  it('reads the first row as the column names and every row under it as values', async () => {
    // arrange
    const bytes = await workbookOf([
      {
        name: 'Objects',
        rows: [
          ['registerNo', 'territorialOffice'],
          ['3-00219', '1 saylı Bakı Ərazi İdarəsi'],
        ],
      },
    ]);

    // act
    const [sheet] = await reader.read(bytes);

    // assert
    expect(sheet?.name).toBe('Objects');
    expect(sheet?.rows).toEqual([
      {
        number: 2,
        cells: {
          registerNo: '3-00219',
          territorialOffice: '1 saylı Bakı Ərazi İdarəsi',
        },
      },
    ]);
  });

  /*
   * The whole reason every column of the models is text. A register number is a
   * 12-digit body whose leading zero is significant, and reading the cell as the
   * number it looks like is how some of the archive's own registers lost it
   * (ADR-0010 §2).
   */
  it('hands back a number as the text of the cell', async () => {
    // arrange
    const bytes = await workbookOf([
      {
        name: 'Objects',
        rows: [
          ['registerNo', 'totalArea'],
          ['005013055966-10301', 162.9],
        ],
      },
    ]);

    // act
    const [sheet] = await reader.read(bytes);

    // assert
    expect(sheet?.rows[0]?.cells).toEqual({
      registerNo: '005013055966-10301',
      totalArea: '162.9',
    });
  });

  // The sources write their dates as text in exactly this form, and every date
  // column of the models is a string for that reason.
  it('writes a date cell the way the register writes one', async () => {
    // arrange
    const bytes = await workbookOf([
      {
        name: 'Documents',
        rows: [['issuedOn'], [new Date(Date.UTC(1999, 3, 15))]],
      },
    ]);

    // act
    const [sheet] = await reader.read(bytes);

    // assert
    expect(sheet?.rows[0]?.cells.issuedOn).toBe('15.04.1999');
  });

  it('keeps the row number the file shows, so a refusal can be looked up', async () => {
    // arrange
    const bytes = await workbookOf([
      {
        name: 'Objects',
        rows: [['registerNo'], ['3-00219'], ['2257'], ['415']],
      },
    ]);

    // act
    const [sheet] = await reader.read(bytes);

    // assert
    expect(sheet?.rows.map(row => row.number)).toEqual([2, 3, 4]);
  });

  /*
   * Formatting carried past the last record, which every one of these files has.
   * Reporting it as a record with no register number would fill the report with
   * problems nobody wrote.
   */
  it('drops a row with nothing in any named column', async () => {
    // arrange
    const bytes = await workbookOf([
      {
        name: 'Objects',
        rows: [['registerNo'], ['3-00219'], [null], ['2257']],
      },
    ]);

    // act
    const [sheet] = await reader.read(bytes);

    // assert
    expect(sheet?.rows.map(row => row.cells.registerNo)).toEqual([
      '3-00219',
      '2257',
    ]);
  });

  it('does not read a column the header row left unnamed', async () => {
    // arrange
    const bytes = await workbookOf([
      {
        name: 'Objects',
        rows: [
          ['registerNo', null, 'district'],
          ['3-00219', 'kağız cırılıb', 'Nəsimi rayonu'],
        ],
      },
    ]);

    // act
    const [sheet] = await reader.read(bytes);

    // assert
    expect(sheet?.rows[0]?.cells).toEqual({
      registerNo: '3-00219',
      district: 'Nəsimi rayonu',
    });
  });

  it('reads every sheet the workbook holds', async () => {
    // arrange
    const bytes = await workbookOf([
      { name: 'Objects', rows: [['registerNo'], ['3-00219']] },
      { name: 'Addresses', rows: [['value'], ['Zabrat qəsəbəsi']] },
    ]);

    // act
    const sheets = await reader.read(bytes);

    // assert
    expect(sheets.map(sheet => sheet.name)).toEqual(['Objects', 'Addresses']);
  });

  it('refuses bytes that are not a workbook at all', async () => {
    // act, assert
    await expect(
      reader.read(Buffer.from('ünvan;reyestr nömrəsi\n', 'utf8')),
    ).rejects.toBeInstanceOf(WorkbookUnreadableError);
  });
});
