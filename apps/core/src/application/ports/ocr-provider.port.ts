/** One page's worth of input for the OCR provider. */
export type OcrPageInput = {
  /** Object-store key of the page image to recognise. */
  imageStorageKey: string;
  /** MIME type of the source document — a hint for the provider. */
  contentType: string;
};

/** A single recognised token/region with its box, if the provider reports one. */
export type OcrBox = {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  confidence: number;
};

/** What the provider returns for one page (PRD §4.3). */
export type OcrPageResult = {
  /** Recognised text for the whole page. */
  text: string;
  /** Page-level confidence, 0..1. */
  confidence: number;
  /** Optional bounding boxes; stored as-is (JSON) by the pipeline. */
  boxes?: OcrBox[];
};

/**
 * Port over an OCR provider (ADR-0003). The MVP ships a deterministic mock; a
 * real adapter (e.g. a hosted OCR API) is dropped in without touching callers.
 */
export abstract class OCRProvider {
  abstract recognize(input: OcrPageInput): Promise<OcrPageResult>;
}
