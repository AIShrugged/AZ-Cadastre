import type { Logger } from '@cadastre/logger';

import type { FieldExtractor } from '../../application/ports/outbound/index.js';
import {
  ARCHIVE_QR_FIELDS,
  ARCHIVE_SIGNED_COPY_SPEC,
  RecognisedText,
  type ArchiveQrField,
} from '../../domain/value-objects/index.js';

import type { DigitisedPdf } from './signed-pdf.digitiser.js';

/** The eight lines of the comparison, as the archive's own copy states them. */
export type ArchiveSheetLines = Readonly<Record<ArchiveQrField, string | null>>;

/*
 * What came of reading the copy: its lines, or the one word for why there are
 * none (COMM-151).
 *
 * The two used to be the same eight nulls. A copy the reader answered nothing
 * about and a copy the reader never got to look at reached the inspector as one
 * sentence — "the archive states nothing" — and only one of them is the
 * archive's silence; the other is our failure and belongs on our side of the
 * page.
 */
export type ReadSheet =
  | { readonly lines: ArchiveSheetLines }
  | { readonly unread: UnreadSheetReason };

export type UnreadSheetReason =
  // Digitised into no sheets at all, so there was nothing to hand a reader.
  | 'NoSheets'
  // The reader was asked and refused, timed out, or answered unusably.
  | 'ReaderRefused';

/**
 * What the archive's own signed copy states, read by the reader that reads
 * every other sheet in the system (ADR-0038, narrowing ADR-0035).
 *
 * The first reader of this sheet matched the schema's labels against the text
 * and took whatever followed one. It was written for a panel of labelled rows
 * and the sheet turned out to be a letter with an order copied out under it in
 * prose: `ünvan` matched inside `ünvanında qeydiyyatda olan`, `sahəsi` inside
 * `torpaq sahəsinin ayrılmasını xahiş etmişdir`, and the comparison reported a
 * valid paper as contradicted by the archive on two lines (COMM-145). Prose has
 * no labels to key to, so there is no parser to fix — the sheet is read the way
 * a sheet of a package is read, by the extraction stage, against
 * `ARCHIVE_SIGNED_COPY_SPEC`.
 *
 * Nothing it can fail at is fatal. A reader that refuses or times out leaves no
 * lines at all, and the stage answers from the `verifyQr` metadata alone —
 * which is what it answered before there was a copy to read. That direction is
 * deliberate: an unread line never reaches the inspector as a finding, and the
 * one thing this reading must never do is turn a failure of its own into an
 * accusation against the paper.
 *
 * It does say which it was, though (COMM-151). A reader that refused answers
 * `unread`, and the comparison marks the lines `NotRead`; a reader that looked
 * and found six of eight answers with those six and two nulls, and the two are
 * lines the archive's copy does not print. Both used to be eight nulls.
 */
export class SignedSheetReader {
  constructor(
    private readonly extractor: FieldExtractor,
    private readonly logger: Logger,
  ) {}

  async read(sheet: DigitisedPdf): Promise<ReadSheet> {
    if (sheet.sheets.length === 0) {
      this.logger.warn("The archive's signed copy could not be read", {
        because: 'NoSheets',
        how: sheet.how,
      });

      return { unread: 'NoSheets' };
    }

    const startedAt = Date.now();

    try {
      const fields = await this.extractor.extract({
        text: RecognisedText.of(sheet.text),
        spec: ARCHIVE_SIGNED_COPY_SPEC,
        sheets: sheet.sheets.map(page => ({
          number: page.number,
          image: page.image,
          text: page.text,
          read: page.read,
        })),
      });

      const read = new Map(
        fields.map(field => [field.key.value, field.value.value]),
      );
      // Which lines the copy turned out to state, never what they say: they are
      // a name, an address and a plot off somebody's papers (ADR-0008).
      const stated = ARCHIVE_QR_FIELDS.filter(field => read.has(field));

      /*
       * A reader that looked at a copy and came back with none of the eight is
       * not the same event as one that came back with six, and it is the one
       * worth waking somebody for: the comparison it produces is empty, and
       * empty is what the customer's package showed (COMM-151). It is still an
       * answer and not a failure — the copy may genuinely print none of them —
       * so it is a warning and not an `unread`.
       */
      this.logger[stated.length === 0 ? 'warn' : 'debug'](
        "The archive's signed copy was read",
        {
          sheets: sheet.sheets.length,
          how: sheet.how,
          stated,
          durationMs: Date.now() - startedAt,
        },
      );

      return {
        lines: Object.fromEntries(
          ARCHIVE_QR_FIELDS.map(field => [field, printed(read.get(field))]),
        ) as ArchiveSheetLines,
      };
    } catch (error) {
      this.logger.warn("The archive's signed copy could not be read", {
        because: 'ReaderRefused',
        sheets: sheet.sheets.length,
        how: sheet.how,
        durationMs: Date.now() - startedAt,
        error,
      });

      return { unread: 'ReaderRefused' };
    }
  }
}

function printed(raw: string | undefined): string | null {
  const trimmed = raw?.trim() ?? '';

  return trimmed.length === 0 ? null : trimmed;
}
