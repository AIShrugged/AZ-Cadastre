import { describe, expect, it } from 'vitest';

import type { SheetGrid } from '../sheets.js';

import { tableOf } from './sheet-layout.js';

function grid(name: string, rows: readonly (readonly string[])[]): SheetGrid {
  return {
    name,
    rows: rows.map((cells, index) => ({
      number: index + 1,
      cells: [...cells],
    })),
  };
}

describe('reading a sheet of the register import template', () => {
  it('takes the first row as the column names and every row under it as records', () => {
    // arrange
    const sheet = grid('Objects', [
      ['registerNo', 'territorialOffice'],
      ['3-00219', '1 saylı Bakı Ərazi İdarəsi'],
    ]);

    // act
    const table = tableOf(sheet);

    // assert
    expect(table.headers).toEqual([['registerNo', 'territorialOffice']]);
    expect(table.rows).toEqual([
      {
        number: 2,
        values: ['3-00219', '1 saylı Bakı Ərazi İdarəsi'],
        cells: {
          registerNo: '3-00219',
          territorialOffice: '1 saylı Bakı Ərazi İdarəsi',
        },
      },
    ]);
  });

  /*
   * Formatting carried past the last record, which every one of these files has.
   * Reading it as a record with no register number would fill the report with
   * problems nobody wrote.
   */
  it('drops a row with nothing in any column', () => {
    // arrange
    const sheet = grid('Objects', [
      ['registerNo'],
      ['3-00219'],
      [''],
      ['2257'],
    ]);

    // act
    const table = tableOf(sheet);

    // assert
    expect(table.rows.map(row => row.number)).toEqual([2, 4]);
  });
});

describe('reading a sheet of one of the archive registers', () => {
  /*
   * The six files the customer stores document themselves: column A labels the
   * row, the office's Azerbaijani headers come first, an English translation
   * under them, a description of each column under that, and an example. A
   * reader that took row 1 as the headers would take the English header row as
   * a record.
   */
  const HOVSAN = grid('qəbul edilən', [
    ['Column Headers (Azerbaijani)', 'Sıra №-si', 'İnventar №', 'Ünvan'],
    ['Column Headers (English)', 'Row No.', 'Inventory No.', 'Adress'],
    [
      'Column Descriptions (English)',
      'Sequential record number',
      'Inventory reference number',
      'Address of the immovable property object',
    ],
    ['Example Row', '1', '1608002040', 'Hövsan qəsəbəsi'],
    ['', '1', '2088', 'Bakı şəhəri, Xəzər rayonu, Hövsan qəsəbəsi, sahə 12'],
  ]);

  it('reads both header rows, so a column headed twice is read twice', () => {
    // act
    const table = tableOf(HOVSAN);

    // assert
    expect(table.headers).toEqual([
      ['Column Headers (Azerbaijani)', 'Sıra №-si', 'İnventar №', 'Ünvan'],
      ['Column Headers (English)', 'Row No.', 'Inventory No.', 'Adress'],
    ]);
  });

  it('reads the rows the sheet does not label, and none of the ones it does', () => {
    // act
    const table = tableOf(HOVSAN);

    // assert
    expect(table.rows.map(row => row.number)).toEqual([5]);
    expect(table.rows[0]?.values[2]).toBe('2088');
  });

  /*
   * The example row is an illustration and not a record — in `Baki-auksion` it
   * is not even aligned with the headers above it, because whoever pasted it in
   * left out the row number. Reading it would put a district into the column
   * headed `Sıra №-si`.
   */
  it('does not read the example row as a record', () => {
    // act
    const table = tableOf(HOVSAN);

    // assert
    expect(table.rows).toHaveLength(1);
  });

  /*
   * The sale-contract sheets of the ƏMDK register put a merged title across the
   * whole of row 1, above the headers.
   */
  it('reads past a merged title row above the headers', () => {
    // arrange
    const sheet = grid('registr-2as', [
      [
        'Information on sale and purchase agreements for state land plots',
        'Information on sale and purchase agreements for state land plots',
      ],
      ['Column Headers (Azerbaijani)', '№', 'Müqavilənin nömrəsi'],
      ['Column Descriptions (English)', 'Sequential record number', 'Number'],
      ['Example Row', '1', '2490'],
      ['', '1', '2491'],
    ]);

    // act
    const table = tableOf(sheet);

    // assert
    expect(table.headers).toEqual([
      ['Column Headers (Azerbaijani)', '№', 'Müqavilənin nömrəsi'],
    ]);
    expect(table.rows.map(row => row.values[2])).toEqual(['2491']);
  });

  // `QEYRI-YAS.-SBTİ` carries one, about group headings inside its data rows.
  it('does not read the structural note as a record', () => {
    // arrange
    const sheet = grid('Sheet1', [
      ['Column Headers (Azerbaijani with cyrillic alphabet)', '№', 'Цнван'],
      ['Column Headers (English)', 'Row No.', 'Address'],
      ['⚠ STRUCTURAL NOTE: certain rows serve as group headings', '', ''],
      ['', '1', 'Гарачухур'],
    ]);

    // act
    const table = tableOf(sheet);

    // assert
    expect(table.rows.map(row => row.values[2])).toEqual(['Гарачухур']);
  });
});
