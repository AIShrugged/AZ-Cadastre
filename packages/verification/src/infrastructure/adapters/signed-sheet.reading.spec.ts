import { describe, expect, it } from 'vitest';

import { HUMBETOV_ARCHIVE_SHEET } from '../../../test/humbetov-sheet.fixture.js';

import { readSignedSheet } from './signed-sheet.reading.js';

// The panel as a text layer renders it: label and value on one line.
const IN_ONE_LINE = [
  'İmzalayan: Məmmədov Anar',
  'İmza tarixi: 14.01.2026',
  'Sertifikatı verən təşkilat: B.EST Certificate Services CA',
  'Struktur bölmə: DÖVLƏT ARXİVİNİN BAKI FİLİALI',
  'Sertifikatın etibarlılıq müddəti: 14.01.2025 - 14.01.2027',
  'İmza təsdiqləndi',
].join('\n');

describe('readSignedSheet', () => {
  it('reads the six lines of the signature panel', () => {
    expect(readSignedSheet(IN_ONE_LINE)).toEqual({
      signedBy: 'Məmmədov Anar',
      signedOn: '14.01.2026',
      organisation: 'B.EST Certificate Services CA',
      unit: 'DÖVLƏT ARXİVİNİN BAKI FİLİALI',
      certificateValidity: '14.01.2025 - 14.01.2027',
      valid: true,
    });
  });

  /*
   * The same two-column panel digitised by OCR rather than parsed off a text
   * layer: the reader puts the label on one line and the value on the next, and
   * both shapes occur on the same sheet.
   */
  it('reads a value the reader put on the line below its label', () => {
    const panel = readSignedSheet(
      ['İmzalayan', 'Məmmədov Anar', 'İmza tarixi', '14.01.2026'].join('\n'),
    );

    expect(panel.signedBy).toBe('Məmmədov Anar');
    expect(panel.signedOn).toBe('14.01.2026');
  });

  /*
   * A heading followed by another heading states nothing, and answering with
   * the next label would be a reading nobody printed.
   */
  it('reads nothing where one label is followed by the next', () => {
    const panel = readSignedSheet(
      ['İmzalayan', 'İmza tarixi', '14.01.2026'].join('\n'),
    );

    expect(panel.signedBy).toBeNull();
  });

  /*
   * An OCR pass over an Azerbaijani scan returns the diacritics half-applied,
   * and a label table written in the printed spelling would match nothing.
   */
  it('reads a panel whose diacritics the reader dropped', () => {
    const panel = readSignedSheet(
      [
        'Imzalayan: Memmedov Anar',
        'Sertifikatin etibarliliq muddeti: 14.01.2025 - 14.01.2027',
        'Imza tesdiqlendi',
      ].join('\n'),
    );

    expect(panel.signedBy).toBe('Memmedov Anar');
    expect(panel.certificateValidity).toBe('14.01.2025 - 14.01.2027');
    expect(panel.valid).toBe(true);
  });

  /*
   * "İmza təsdiqlənmədi" contains "imza təsdiqlən": a reader asking about
   * confirmation first would read every refusal as a confirmation, which is the
   * one mistake this line must not make.
   */
  it('reads a refusal as a refusal and not as its own prefix', () => {
    expect(readSignedSheet('İmza təsdiqlənmədi').valid).toBe(false);
    expect(readSignedSheet('Подпись не подтверждена').valid).toBe(false);
  });

  // A sheet that makes no claim about its signature has not denied it, and
  // reporting a denial would turn an unread panel into a finding.
  it('says nothing about a signature the sheet says nothing about', () => {
    const panel = readSignedSheet('Sənədin nömrəsi: 1471');

    expect(panel.valid).toBeNull();
    expect(panel.signedBy).toBeNull();
  });

  /*
   * The regression COMM-145 is about, from the other side.
   *
   * The archive's copy in the Hümbətov package has no signature panel on it at
   * all — it is a letter with an order copied out under it — and this reader
   * must come back with nothing rather than with words it found by matching a
   * label inside one. The eight lines are not its business any more; they are
   * read by the extraction stage (`signed-sheet.reader.ts`).
   */
  it('reads nothing off a sheet that is prose and carries no panel', () => {
    expect(readSignedSheet(HUMBETOV_ARCHIVE_SHEET.join('\n'))).toEqual({
      signedBy: null,
      organisation: null,
      unit: null,
      signedOn: null,
      certificateValidity: null,
      valid: null,
    });
  });

  it('reads a panel printed in Russian', () => {
    const panel = readSignedSheet(
      [
        'Кем подписан: Мамедов Анар',
        'Дата подписания: 14.01.2026',
        'Организация, выдавшая сертификат: B.EST Certificate Services CA',
        'Структурное подразделение: Бакинский филиал',
        'Срок действия сертификата: 14.01.2025 - 14.01.2027',
        'Подпись подтверждена',
      ].join('\n'),
    );

    expect(panel).toEqual({
      signedBy: 'Мамедов Анар',
      signedOn: '14.01.2026',
      organisation: 'B.EST Certificate Services CA',
      unit: 'Бакинский филиал',
      certificateValidity: '14.01.2025 - 14.01.2027',
      valid: true,
    });
  });
});
