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

const NOTHING: ArchiveSheetLines = Object.fromEntries(
  ARCHIVE_QR_FIELDS.map(field => [field, null]),
) as ArchiveSheetLines;

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
 * Nothing it can fail at is fatal. A reader that refuses, times out or answers
 * with nothing leaves eight nulls, and the stage answers from the `verifyQr`
 * metadata alone — which is what it answered before there was a copy to read.
 * That direction is deliberate: an unread line reaches the inspector as
 * `NotStated`, and the one thing this reading must never do is turn a failure
 * of its own into a finding against the paper.
 */
export class SignedSheetReader {
  constructor(
    private readonly extractor: FieldExtractor,
    private readonly logger: Logger,
  ) {}

  async read(sheet: DigitisedPdf): Promise<ArchiveSheetLines> {
    if (sheet.sheets.length === 0) return NOTHING;

    const startedAt = Date.now();

    try {
      const fields = await this.extractor.extract({
        text: RecognisedText.of(sheet.text),
        sheets: sheet.sheets.map(page => ({
          number: page.number,
          image: page.image,
          text: page.text,
          read: page.read,
        })),
        spec: ARCHIVE_SIGNED_COPY_SPEC,
      });

      const read = new Map(
        fields.map(field => [field.key.value, field.value.value]),
      );

      this.logger.debug("The archive's signed copy was read", {
        sheets: sheet.sheets.length,
        how: sheet.how,
        // Which lines the copy turned out to state, never what they say: they
        // are a name, an address and a plot off somebody's papers (ADR-0008).
        stated: ARCHIVE_QR_FIELDS.filter(field => read.has(field)),
        durationMs: Date.now() - startedAt,
      });

      return Object.fromEntries(
        ARCHIVE_QR_FIELDS.map(field => [field, stated(read.get(field))]),
      ) as ArchiveSheetLines;
    } catch (error) {
      this.logger.warn("The archive's signed copy could not be read", {
        sheets: sheet.sheets.length,
        how: sheet.how,
        durationMs: Date.now() - startedAt,
        error,
      });

      return NOTHING;
    }
  }
}

function stated(raw: string | undefined): string | null {
  const trimmed = raw?.trim() ?? '';

  return trimmed.length === 0 ? null : trimmed;
}
