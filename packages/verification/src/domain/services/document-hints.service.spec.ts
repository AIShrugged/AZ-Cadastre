import { describe, expect, it } from 'vitest';

import {
  DocumentTypeSpec,
  VerificationProfile,
} from '../value-objects/index.js';

import {
  enclosesHeading,
  headingMatch,
  looksLike,
} from './document-hints.service.js';

const CADASTRE = VerificationProfile.CADASTRE.specs;

function typeOf(text: string): string | null {
  return looksLike(text, CADASTRE)?.type.value ?? null;
}

function aTypeHinted(key: string, ...hints: readonly string[]) {
  return DocumentTypeSpec.of({
    key,
    description: `a ${key}`,
    hints,
    required: true,
    expectsStamp: false,
    expectsSignature: false,
    fields: [],
  });
}

describe('looksLike', () => {
  it('finds the type whose heading the page carries', () => {
    expect(typeOf('Ödəniş qəbzi No: QB-2025-88301')).toBe('payment_receipt');
  });

  it('reads a heading printed in capitals, dotted İ and all', () => {
    expect(typeOf('ESKİZ LAYİHƏSİ')).toBe('sketch_project');
    expect(typeOf('ARXİV ARAYIŞI')).toBe('archive_certificate');
  });

  it('reads a heading OCR stripped the diacritics off', () => {
    expect(typeOf('SEXSIYYET VESIQESI')).toBe('identity_card');
    expect(typeOf('ODENIS QEBZI')).toBe('payment_receipt');
  });

  it('reads the Russian heading as readily as the Azerbaijani one', () => {
    expect(typeOf('УДОСТОВЕРЕНИЕ ЛИЧНОСТИ')).toBe('identity_card');
    expect(typeOf('ПЛАН-СХЕМА ЗЕМЕЛЬНОГО УЧАСТКА')).toBe('land_plot_plan');
  });

  it('takes the heading at the top over a type mentioned further down', () => {
    const text = [
      'DÖVLƏT QEYDİYYATI HAQQINDA ƏRİZƏ',
      'Şəxsiyyət vəsiqəsi No: AZE1234567',
    ].join('\n');

    expect(typeOf(text)).toBe('application');
  });

  it('takes the longer heading when two start in the same place', () => {
    const candidates = [
      aTypeHinted('act', 'akt'),
      aTypeHinted('handover_act', 'akt qəbulu'),
    ];

    expect(looksLike('AKT QƏBULU', candidates)?.type.value).toBe(
      'handover_act',
    );
  });

  it('finds nothing on a page that names no type', () => {
    expect(typeOf('bir məktub')).toBeNull();
  });

  it('finds nothing on a page OCR read nothing off', () => {
    expect(typeOf('')).toBeNull();
  });

  it('offers only a type it was given', () => {
    const withoutReceipt = CADASTRE.filter(
      spec => spec.type.value !== 'payment_receipt',
    );

    expect(looksLike('ÖDƏNİŞ QƏBZİ', withoutReceipt)?.type.value).not.toBe(
      'payment_receipt',
    );
  });
});

describe('headingMatch', () => {
  it('says where the heading it found sits and how long it is', () => {
    const found = headingMatch('BİR MƏTN ÖDƏNİŞ QƏBZİ', CADASTRE);

    expect(found?.spec.type.value).toBe('payment_receipt');
    expect(found?.at).toBe(9);
    expect(found?.length).toBe('ödəniş qəbzi'.length);
  });

  it('finds nothing where looksLike finds nothing', () => {
    expect(headingMatch('bir məktub', CADASTRE)).toBeNull();
  });
});

// A heading of one list that swallows a heading of another is the same words
// read short — "технический паспорт" over the "паспорт" inside it — and a
// caller weighing two lists has to be able to tell that from two headings that
// merely both appear on the sheet (ADR-0022).
describe('enclosesHeading', () => {
  const TEXT = 'ТЕХНИЧЕСКИЙ ПАСПОРТ, 1998 г.';
  const OTHERS = [
    aTypeHinted('technical_passport', 'технический паспорт'),
    aTypeHinted('covering_letter', 'сопроводительное письмо'),
  ];

  it('sees a longer heading that contains the span given', () => {
    const found = headingMatch(TEXT, CADASTRE);

    expect(found?.spec.type.value).toBe('identity_card');
    expect(enclosesHeading(TEXT, found!, OTHERS)).toBe(true);
  });

  // The enclosing heading is rarely the one that starts the sheet, so the
  // question is asked of the whole list and not of its best match.
  it('sees it even when another candidate matches earlier', () => {
    const text = 'СОПРОВОДИТЕЛЬНОЕ ПИСЬМО и ТЕХНИЧЕСКИЙ ПАСПОРТ';
    const found = headingMatch(text, CADASTRE);

    expect(enclosesHeading(text, found!, OTHERS)).toBe(true);
  });

  it('does not call two headings that merely both appear an enclosure', () => {
    const text = 'MÜŞAYİƏT MƏKTUBU\nDÖVLƏT QEYDİYYATI HAQQINDA ƏRİZƏ';
    const found = headingMatch(text, CADASTRE);

    expect(found?.spec.type.value).toBe('application');
    expect(
      enclosesHeading(text, found!, [
        aTypeHinted('covering_letter', 'müşayiət məktubu'),
      ]),
    ).toBe(false);
  });

  it('does not call a heading of the same length an enclosure of itself', () => {
    const found = headingMatch('ÖDƏNİŞ QƏBZİ', CADASTRE);

    expect(
      enclosesHeading('ÖDƏNİŞ QƏBZİ', found!, [
        aTypeHinted('receipt_copy', 'ödəniş qəbzi'),
      ]),
    ).toBe(false);
  });
});
