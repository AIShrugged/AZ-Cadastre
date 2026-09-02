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

  it('names a paper the catalogue knows and the profile does not, rather than bucketing it', async () => {
    const classification = await classify(
      ['KURYER XİDMƏTİNİN BİLDİRİŞİ', 'Göndərən: "AzPost" MMC'].join('\n'),
    );

    expect(classification.type.value).toBe('out_of_profile');
    expect(classification.knownAs?.value).toBe('courier_waybill');
  });

  it("reads the registry's own routing sheet as the service sheet it is", async () => {
    const classification = await classify(
      ['DÖVRİYYƏ VƏRƏQİ', 'Şöbə: Qeydiyyat'].join('\n'),
    );

    expect(classification.knownAs?.value).toBe('registrar_routing_sheet');
  });

  it('reads a catalogued paper written in Russian as readily as one in Azerbaijani', async () => {
    const classification = await classify('СОПРОВОДИТЕЛЬНОЕ ПИСЬМО');

    expect(classification.knownAs?.value).toBe('covering_letter');
  });

  // The catalogue is a fallback and never a rival: only the profile's own types
  // answer a requirement, so a heading it knows wins outright.
  it('answers with the profile even when a catalogued heading appears first on the sheet', async () => {
    const classification = await classify(
      ['MÜŞAYİƏT MƏKTUBU', 'DÖVLƏT QEYDİYYATI HAQQINDA ƏRİZƏ'].join('\n'),
    );

    expect(classification.type.value).toBe('application');
    expect(classification.knownAs).toBeNull();
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
    expect(classification.knownAs).toBeNull();
  });

  // A document the catalogue has no name for is still reported, as the extra
  // document it has always been.
  it('leaves a document neither list knows unnamed rather than guessing at one', async () => {
    const classification = await classify(
      'A LETTER ABOUT NOTHING IN PARTICULAR',
    );

    expect(classification.knownAs).toBeNull();
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
