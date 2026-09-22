import { describe, expect, it } from 'vitest';

import { readSignedSheet } from './signed-sheet.reading.js';

// The panel as a text layer renders it: label and value on one line.
const IN_ONE_LINE = [
  'Sənədin nömrəsi: 1471',
  'Sənədin tarixi: 29.10.1998',
  'Sənədi verən orqan: Bakı şəhəri Sabunçu Rayon İcra Hakimiyyəti',
  'Ərizəçi: Qusadze Vera Vladimirovna',
  'Ünvanı: 1-ci Zabrat qəsəbəsi',
  'Sahəsi: 0,04 ha',
  'Bəndi: 2.7',
  'Arxiv arayışı: Fond 130, siyahı 1, iş 476',
  'İmzalayan: Məmmədov Anar',
  'İmza tarixi: 14.01.2026',
  'Sertifikatı verən təşkilat: B.EST Certificate Services CA',
  'Struktur bölmə: DÖVLƏT ARXİVİNİN BAKI FİLİALI',
  'Sertifikatın etibarlılıq müddəti: 14.01.2025 - 14.01.2027',
  'İmza təsdiqləndi',
].join('\n');

describe('readSignedSheet', () => {
  it('reads the eight lines the archive is held against', () => {
    const { lines } = readSignedSheet(IN_ONE_LINE);

    expect(lines).toEqual({
      document_no: '1471',
      issue_date: '29.10.1998',
      issuing_authority: 'Bakı şəhəri Sabunçu Rayon İcra Hakimiyyəti',
      holder_name: 'Qusadze Vera Vladimirovna',
      property_address: '1-ci Zabrat qəsəbəsi',
      plot_area: '0,04 ha',
      decree_item: '2.7',
      archive_reference: 'Fond 130, siyahı 1, iş 476',
    });
  });

  it('reads the six lines of the signature panel', () => {
    const { signature } = readSignedSheet(IN_ONE_LINE);

    expect(signature).toEqual({
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
    const { signature } = readSignedSheet(
      ['İmzalayan', 'Məmmədov Anar', 'İmza tarixi', '14.01.2026'].join('\n'),
    );

    expect(signature.signedBy).toBe('Məmmədov Anar');
    expect(signature.signedOn).toBe('14.01.2026');
  });

  /*
   * A heading followed by another heading states nothing, and answering with
   * the next label would be a reading nobody printed.
   */
  it('reads nothing where one label is followed by the next', () => {
    const { signature } = readSignedSheet(
      ['İmzalayan', 'İmza tarixi', '14.01.2026'].join('\n'),
    );

    expect(signature.signedBy).toBeNull();
  });

  /*
   * An OCR pass over an Azerbaijani scan returns the diacritics half-applied,
   * and a label table written in the printed spelling would match nothing.
   */
  it('reads a panel whose diacritics the reader dropped', () => {
    const { signature } = readSignedSheet(
      [
        'Imzalayan: Memmedov Anar',
        'Sertifikatin etibarliliq muddeti: 14.01.2025 - 14.01.2027',
        'Imza tesdiqlendi',
      ].join('\n'),
    );

    expect(signature.signedBy).toBe('Memmedov Anar');
    expect(signature.certificateValidity).toBe('14.01.2025 - 14.01.2027');
    expect(signature.valid).toBe(true);
  });

  /*
   * "İmza təsdiqlənmədi" contains "imza təsdiqlən": a reader asking about
   * confirmation first would read every refusal as a confirmation, which is the
   * one mistake this line must not make.
   */
  it('reads a refusal as a refusal and not as its own prefix', () => {
    expect(readSignedSheet('İmza təsdiqlənmədi').signature.valid).toBe(false);
    expect(readSignedSheet('Подпись не подтверждена').signature.valid).toBe(
      false,
    );
  });

  // A sheet that makes no claim about its signature has not denied it, and
  // reporting a denial would turn an unread panel into a finding.
  it('says nothing about a signature the sheet says nothing about', () => {
    const { signature, lines } = readSignedSheet('Sənədin nömrəsi: 1471');

    expect(signature.valid).toBeNull();
    expect(signature.signedBy).toBeNull();
    expect(lines.holder_name).toBeNull();
  });

  it('reads a panel printed in Russian', () => {
    const { signature } = readSignedSheet(
      [
        'Кем подписан: Мамедов Анар',
        'Дата подписания: 14.01.2026',
        'Организация, выдавшая сертификат: B.EST Certificate Services CA',
        'Структурное подразделение: Бакинский филиал',
        'Срок действия сертификата: 14.01.2025 - 14.01.2027',
        'Подпись подтверждена',
      ].join('\n'),
    );

    expect(signature).toEqual({
      signedBy: 'Мамедов Анар',
      signedOn: '14.01.2026',
      organisation: 'B.EST Certificate Services CA',
      unit: 'Бакинский филиал',
      certificateValidity: '14.01.2025 - 14.01.2027',
      valid: true,
    });
  });
});
