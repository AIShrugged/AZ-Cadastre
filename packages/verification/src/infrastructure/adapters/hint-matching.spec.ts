import { describe, expect, it } from 'vitest';

import {
  DocumentTypeSpec,
  VerificationProfile,
} from '../../domain/value-objects/index.js';

import { looksLike } from './hint-matching.js';

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
