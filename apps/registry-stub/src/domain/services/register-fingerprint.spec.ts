import { describe, expect, it } from 'vitest';

import type { WorkbookShape } from '../sheets.js';

import { bestFit, readableShare, scoreRegisters } from './register-fingerprint.js'; // prettier-ignore

function shape(
  sheets: readonly (readonly [string, readonly string[][]])[],
): WorkbookShape {
  return {
    sheets: sheets.map(([name, headers]) => ({ name, headers, rows: 1 })),
  };
}

describe('recognising which archive register a workbook is', () => {
  it('names the register whose sheets and column headers it carries', () => {
    // arrange
    const workbook = shape([
      [
        'qəbul edilən',
        [
          ['Sıra №-si', 'İnventar №', 'Abşeron Ə.İ üzrə qeydiyyat nömrəsi', 'AbşeronƏ.İ reyestr nömrəsi', 'Hüquq sahibi (-ləri)', 'Ünvan', 'Bakı Əİ üzrə reyestr nömrəsi', 'Yeni Hüquq sahibləri'], // prettier-ignore
        ],
      ],
      ['təhvil verilən', [['Sıra №', 'Müraciət №', 'Ünvan', 'Təhvil verilmə tarixi']]], // prettier-ignore
    ]);

    // act
    const fit = bestFit(workbook);

    // assert
    expect(fit?.register.id).toBe('Hovsan');
  });

  /*
   * Two of the six files carry a sheet called `Sheet1`, so a name alone decides
   * nothing. The columns under it are what separate them — and not merely the
   * code page, since the technical passport database is written in it too: the
   * register book of the former inventory office is the only one that heads a
   * column `Рейестр №-си`.
   */
  it('separates two registers that carry a sheet of the same name', () => {
    // arrange
    const cyrillic = shape([
      [
        'Sheet1',
        [
          ['№', 'Тарих', 'Рейестр №-си', 'Цнван', 'Мцлкиййятин там Ады'],
          ['Row No.', 'Date', 'Regisrty No.', 'Address', 'Name of the right owner'], // prettier-ignore
        ],
      ],
    ]);

    // act
    const scores = scoreRegisters(cyrillic);

    // assert
    expect(scores[0]?.register.id).toBe('QeyriYasayis');
    expect(scores[0]?.score).toBeGreaterThan(scores[1]?.score ?? 1);
  });

  it('names nothing for a workbook that is none of them', () => {
    // arrange
    const invoices = shape([
      ['Invoices', [['Invoice No.', 'Customer', 'Net', 'VAT', 'Gross']]],
    ]);

    // act
    const fit = bestFit(invoices);

    // assert
    expect(fit).toBeNull();
  });

  /*
   * Reported and not acted on. A file the catalogue recognises whose columns are
   * half unreadable is a register that has grown a column, and the operator is
   * the one who has to know.
   */
  it('says how much of a workbook the lexicon can read', () => {
    // arrange
    const halfKnown = shape([
      ['List 1 ', [['Sıra №', 'Rayon', 'Ünvanı', 'Mülkiyyətin tam adı']]],
      ['Notes', [['Kr', 'KOT', 'Ş', 'm']]],
    ]);

    // act
    const share = readableShare(halfKnown);

    // assert
    expect(share).toBeCloseTo(0.5, 2);
  });
});
