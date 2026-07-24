export type ClassifyInput = {
  /** Full OCR text of the document — its pages joined together. */
  text: string;
  /** Document-type keys the active profile recognises (ADR-0002). */
  candidateTypes: string[];
};

/** A detected document type key (or "unknown") with confidence 0..1. */
export type Classification = {
  type: string;
  confidence: number;
};

/**
 * Port over a document classifier (ADR-0003). One type per document (PRD §3);
 * the set of recognisable types comes from the active profile. The MVP ships a
 * deterministic keyword mock.
 */
export abstract class DocumentClassifier {
  abstract classify(input: ClassifyInput): Promise<Classification>;
}
