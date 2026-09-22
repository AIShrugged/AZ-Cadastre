import type { PageImage } from '../../../domain/value-objects/index.js';

/**
 * The QR codes printed on one sheet, decoded from the picture (ADR-0034).
 *
 * Not a reading and not a guess: a QR symbol carries its own error correction,
 * so a payload that comes back came back whole or did not come back at all.
 * That is what sets this apart from every other port here — the five
 * model-backed stages answer with a confidence, and this one has nothing to be
 * unsure about.
 *
 * A sheet with no code, or one the decoder could not lock onto, answers with
 * an empty list. A decoder that throws leaves the sheet's codes unknown, which
 * the caller must not mistake for a sheet that prints none.
 */
export abstract class QrCodeReader {
  abstract read(image: PageImage): Promise<readonly string[]>;
}
