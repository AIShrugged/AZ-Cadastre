import { describe, expect, it } from 'vitest';

import {
  RecognisedText,
  VerificationProfile,
  type DocumentTypeSpec,
} from '../../domain/value-objects/index.js';

import { DocumentClassifierAdapter } from './document-classifier.adapter.js';

const CADASTRE = VerificationProfile.CADASTRE.specs;

function classify(
  text: string,
  candidates: readonly DocumentTypeSpec[] = CADASTRE,
) {
  return new DocumentClassifierAdapter().classify({
    text: RecognisedText.of(text),
    candidates,
  });
}

const IDENTITY_TEXT = [
  'AZƏRBAYCAN RESPUBLİKASI',
  'ŞƏXSİYYƏT VƏSİQƏSİ',
  'Soyadı: ƏLİYEV',
  'Vəsiqə No: AZE1234567',
].join('\n');

const APPLICATION_TEXT = [
  'DÖVLƏT QEYDİYYATI HAQQINDA ƏRİZƏ',
  'Ərizəçi: ELÇİN ƏLİYEV',
  'Şəxsiyyət vəsiqəsi No: AZE1234567',
].join('\n');

describe('DocumentClassifierAdapter', () => {
  it('reads an identity card as an identity card', async () => {
    const classification = await classify(IDENTITY_TEXT);

    expect(classification.type.value).toBe('identity_card');
  });

  it('picks the heading over a cross-reference, so an application that cites an identity card is not read as one', async () => {
    const classification = await classify(APPLICATION_TEXT);

    expect(classification.type.value).toBe('application');
  });

  it('reads the plan-scheme of the plot as its own kind', async () => {
    const classification = await classify(
      ['TORPAQ SAHƏSİNİN PLAN-SXEMİ', 'Kadastr nömrəsi: AZ-CAD-1024-311'].join(
        '\n',
      ),
    );

    expect(classification.type.value).toBe('land_plot_plan');
  });

  it('reads the sketch design of the house as its own kind', async () => {
    const classification = await classify(
      ['ESKİZ LAYİHƏSİ', 'Layihə təşkilatı: "AzMemarLayihə" MMC'].join('\n'),
    );

    expect(classification.type.value).toBe('sketch_project');
  });

  it('reads an extract from the order as the order it is an extract of', async () => {
    const classification = await classify(
      ['SƏRƏNCAMDAN ÇIXARIŞ', 'Sərəncam No: R-1147'].join('\n'),
    );

    expect(classification.type.value).toBe('disposal_order');
  });

  it('reads a receipt for the state duty as a receipt', async () => {
    const classification = await classify(
      ['ÖDƏNİŞ QƏBZİ', 'Məbləğ: 60,00 AZN'].join('\n'),
    );

    expect(classification.type.value).toBe('payment_receipt');
  });

  it('reads an archival certificate as an archival certificate', async () => {
    const classification = await classify(
      ['ARXİV ARAYIŞI', 'Arayış No: ARX-2025-0417'].join('\n'),
    );

    expect(classification.type.value).toBe('archive_certificate');
  });

  it('reads a document written in Russian as readily as one in Azerbaijani', async () => {
    const classification = await classify(
      ['УДОСТОВЕРЕНИЕ ЛИЧНОСТИ', 'Фамилия: АЛИЕВ'].join('\n'),
    );

    expect(classification.type.value).toBe('identity_card');
  });

  it('ignores where the candidate sits in the list and looks only at where its heading sits in the text', async () => {
    const reversed = [...CADASTRE].reverse();

    const classification = await classify(IDENTITY_TEXT, reversed);

    expect(classification.type.value).toBe('identity_card');
  });

  it('does not care how the text was cased', async () => {
    const classification = await classify(IDENTITY_TEXT.toLowerCase());

    expect(classification.type.value).toBe('identity_card');
  });

  it("leaves the document unplaced when no candidate's heading appears at all", async () => {
    const classification = await classify(
      'A LETTER ABOUT NOTHING IN PARTICULAR',
    );

    expect(classification.type.isKnown).toBe(false);
  });

  it('leaves a page OCR read nothing off unplaced', async () => {
    const classification = await classify('');

    expect(classification.type.isKnown).toBe(false);
  });

  it('is sure of a heading hit and unsure of a miss', async () => {
    const placed = await classify(IDENTITY_TEXT);
    const unplaced = await classify('nothing recognisable here');

    expect(placed.confidence.value).toBeGreaterThan(unplaced.confidence.value);
  });

  it('only ever answers with a type it was offered, or with none', async () => {
    const offered = CADASTRE.map(spec => spec.type.value);

    for (const text of [IDENTITY_TEXT, APPLICATION_TEXT, 'unrelated']) {
      const classification = await classify(text);

      expect([...offered, 'unknown']).toContain(classification.type.value);
    }
  });

  it('leaves an identity card unplaced when the profile does not expect one', async () => {
    const withoutIdentity = CADASTRE.filter(
      spec => spec.type.value !== 'identity_card',
    );

    const classification = await classify(IDENTITY_TEXT, withoutIdentity);

    expect(classification.type.value).not.toBe('identity_card');
  });
});
