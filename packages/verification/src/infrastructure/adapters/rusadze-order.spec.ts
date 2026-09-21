import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  ContentType,
  DocumentType,
  PageImage,
  RecognisedText,
  StorageKey,
  VerificationProfile,
} from '../../domain/value-objects/index.js';

import { DocumentClassifierAdapter } from './document-classifier.adapter.js';
import { FieldExtractorAdapter } from './field-extractor.adapter.js';
import { NationalArchiveAdapter } from './national-archive.adapter.js';
import { OcrProviderAdapter } from './ocr-provider.adapter.js';

/*
 * The three offline providers are three halves of one demo, and only together
 * do they show the QR check doing its work on a run with everything on `mock`:
 * the reader has to put the 1998 order on the page, the profile has to place
 * the sheet it reads, and the archive has to answer under the reference printed
 * on it (ADR-0028). Each of them is right on its own and the demo is still
 * broken if the three disagree, so the agreement is held here — the paper the
 * reader transcribes IS the paper the extractor reads and the archive holds.
 */

const HOMESTEAD = DocumentType.create('homestead_land_allocation_decision');

// The file the Rusadze package names this paper, through the folder the presign
// step puts in front and the page the splitter renders off the PDF.
const KEY = 'uploads/rusadze/serencam-1471.pdf/pages/page_001.png';

async function transcribe(key = KEY): Promise<string> {
  const reading = new OcrProviderAdapter().recognise(
    PageImage.of(StorageKey.create(key), ContentType.PNG),
  );

  await vi.advanceTimersByTimeAsync(1200);

  return (await reading).text.value;
}

function read(text: string) {
  return new FieldExtractorAdapter().extract({
    text: RecognisedText.of(text),
    sheets: [],
    spec: VerificationProfile.CADASTRE.specFor(HOMESTEAD),
  });
}

describe('the Rusadze order, as the offline providers pass it between them', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is put on the page by the reader, under the name the package files it as', async () => {
    expect(await transcribe()).toContain(
      'Həyətyanı torpaq sahəsinin ayrılması barədə qərar № 1471, 29.10.1998',
    );
  });

  it('is put on the page off the Russian wording too, which the Decree names it by', async () => {
    expect(
      await transcribe('uploads/rusadze/reshenie-priusadebnyy.pdf'),
    ).toContain('№ 1471, 29.10.1998');
  });

  it('is placed by the profile as the Decree 439 paper it is', async () => {
    const classification = await new DocumentClassifierAdapter().classify({
      text: RecognisedText.of(await transcribe()),
      candidates: VerificationProfile.CADASTRE.specs,
    });

    expect(classification.type.value).toBe(HOMESTEAD.value);
  });

  it('is read by the extractor off the lines the reader printed, value for value', async () => {
    const text = await transcribe();

    for (const field of await read(text)) {
      expect(
        text,
        `the sheet does not print ${field.key.value} as the extractor reads it`,
      ).toContain(field.value.value);
    }
  });

  it('is found in the archive under the reference printed beside its code', async () => {
    const text = await transcribe();
    const qrReference = (await read(text)).find(
      field => field.key.value === 'qr_code',
    )?.value.value;

    expect(text).toContain(`QR: ${qrReference}`);
    expect(
      (await new NationalArchiveAdapter().lookupByQr(qrReference ?? ''))
        .outcome,
    ).toBe('Found');
  });
});
