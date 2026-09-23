import { describe, expect, it } from 'vitest';

import { SilentLogger } from '@cadastre/logger';

import {
  HUMBETOV_ARCHIVE_LINES,
  HUMBETOV_ARCHIVE_SHEET,
} from '../../../test/humbetov-sheet.fixture.js';
import {
  FieldExtractor,
  type ExtractionRequest,
} from '../../application/ports/outbound/index.js';
import { ExtractedField } from '../../domain/entities/index.js';
import {
  ARCHIVE_QR_FIELDS,
  Confidence,
  FieldKey,
  FieldValue,
  PageNumber,
  RecognisedText,
  type ArchiveQrField,
} from '../../domain/value-objects/index.js';

import type { DigitisedPdf } from './signed-pdf.digitiser.js';
import {
  SignedSheetReader,
  type ArchiveSheetLines,
  type ReadSheet,
} from './signed-sheet.reader.js';

/*
 * A reader that answers off a table of its own and records what it was asked.
 *
 * What the model would answer off a real sheet is not this spec's business —
 * that is a prompt and a provider. What is this spec's business is that the
 * sheet reaches a reader at all, sheet by sheet, under the schema that names the
 * eight lines, and that whatever comes back is carried across faithfully.
 */
class ReaderStandingIn extends FieldExtractor {
  asked: ExtractionRequest | null = null;

  constructor(
    private readonly answers: Partial<Record<string, string>> = {},
    private readonly refusing = false,
  ) {
    super();
  }

  override async extract(
    request: ExtractionRequest,
  ): Promise<readonly ExtractedField[]> {
    this.asked = request;

    if (this.refusing) throw new Error('the provider would not answer');

    return Object.entries(this.answers).map(([key, value]) =>
      ExtractedField.of(
        FieldKey.create(key),
        FieldValue.create(value ?? ''),
        Confidence.of(0.9),
        PageNumber.first(),
      ),
    );
  }
}

function theSheet(pages: readonly string[] = HUMBETOV_ARCHIVE_SHEET): {
  sheet: DigitisedPdf;
} {
  return {
    sheet: {
      text: pages.join('\n'),
      sheets: pages.map((text, index) => ({
        number: PageNumber.of(index + 1),
        image: null,
        text: RecognisedText.of(text),
        read: Confidence.of(1),
      })),
      how: 'TextLayer',
      pages: pages.length,
    },
  };
}

describe('SignedSheetReader', () => {
  it('asks for every line the comparison holds a paper against', async () => {
    const extractor = new ReaderStandingIn();
    const { sheet } = theSheet();

    await new SignedSheetReader(extractor, new SilentLogger()).read(sheet);

    const asked = extractor.asked?.spec.schema.specs.map(
      spec => spec.key.value,
    );

    expect(asked).toEqual([...ARCHIVE_QR_FIELDS]);
  });

  /*
   * Sheet by sheet and not as one blob: the reader is told which page it is
   * looking at, and the archive's copy puts the covering letter on one page and
   * the order it copies out on the next.
   */
  it('hands the reader the sheet the archive actually sent', async () => {
    const extractor = new ReaderStandingIn();
    const { sheet } = theSheet();

    await new SignedSheetReader(extractor, new SilentLogger()).read(sheet);

    expect(extractor.asked?.sheets).toHaveLength(2);
    expect(extractor.asked?.sheets[1]?.text.value).toContain(
      'ƏSAS: Fond-128, siy.1, iş-1043, vər.-69, 70, 72.',
    );
  });

  it('carries every line the reader answered onto the comparison', async () => {
    const extractor = new ReaderStandingIn(stated(HUMBETOV_ARCHIVE_LINES));
    const { sheet } = theSheet();

    const read = await new SignedSheetReader(
      extractor,
      new SilentLogger(),
    ).read(sheet);

    expect(linesOf(read)).toEqual(HUMBETOV_ARCHIVE_LINES);
  });

  /*
   * A line the archive's copy does not print is null, and null is the answer —
   * not a cue to go looking for something that resembles it. The Hümbətov order
   * prints no item of Decree 439 (COMM-145).
   */
  it('leaves a line the copy does not print unstated', async () => {
    const extractor = new ReaderStandingIn({ document_no: '100' });
    const { sheet } = theSheet();

    const read = await new SignedSheetReader(
      extractor,
      new SilentLogger(),
    ).read(sheet);

    expect(linesOf(read).document_no).toBe('100');
    expect(linesOf(read).decree_item).toBeNull();
  });

  /*
   * A reading that failed is never a finding: the check answers what it
   * answered before there was a copy to read, and an inspector is never told
   * the archive contradicts a paper because a provider timed out (COMM-145).
   *
   * It is no longer eight nulls, though. Eight nulls is what a copy that prints
   * none of the eight looks like, and the two are different facts — one is the
   * archive's copy, the other is us (COMM-151).
   */
  it('says the copy went unread where the reader refuses', async () => {
    const extractor = new ReaderStandingIn({}, true);
    const { sheet } = theSheet();

    const read = await new SignedSheetReader(
      extractor,
      new SilentLogger(),
    ).read(sheet);

    expect(read).toEqual({ unread: 'ReaderRefused' });
  });

  // Told apart from a reader that refused for the same reason the two absences
  // are told apart at all: whoever is looking for the failure has to be sent to
  // the right step (COMM-151).
  it('says a file that digitised to no sheets at all by its own name', async () => {
    const extractor = new ReaderStandingIn();
    const { sheet } = theSheet([]);

    const read = await new SignedSheetReader(
      extractor,
      new SilentLogger(),
    ).read(sheet);

    expect(read).toEqual({ unread: 'NoSheets' });
    expect(extractor.asked).toBeNull();
  });

  /*
   * A copy the reader looked at and found none of the eight on is an answer and
   * not a failure: the copy may genuinely print none of them, and calling that
   * unread would blame ourselves for the archive's silence (COMM-151).
   */
  it('answers with eight nulls where the reader read the copy and found none', async () => {
    const extractor = new ReaderStandingIn({});
    const { sheet } = theSheet();

    const read = await new SignedSheetReader(
      extractor,
      new SilentLogger(),
    ).read(sheet);

    expect(Object.values(linesOf(read)).every(line => line === null)).toBe(
      true,
    );
  });
});

function stated(
  lines: Readonly<Record<ArchiveQrField, string | null>>,
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(lines).filter(([, value]) => value !== null),
  ) as Record<string, string>;
}

function linesOf(read: ReadSheet): ArchiveSheetLines {
  if (!('lines' in read))
    throw new Error(`the copy was not read: ${read.unread}`);

  return read.lines;
}
