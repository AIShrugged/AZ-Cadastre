import type { FieldSpec } from "../../domain/field-schemas.js";

export type ExtractInput = {
  /** Full OCR text of the document. */
  text: string;
  /** The document's detected type key. */
  documentType: string;
  /** Fields to pull, per the type's schema. */
  fields: FieldSpec[];
};

/** One structured field pulled from a document (PRD §4.5). */
export type ExtractedFieldValue = {
  /** Field key from the schema. */
  name: string;
  value: string;
  /** 0..1. */
  confidence: number;
  /** Page the value was found on (1-based). */
  pageNumber: number;
};

/**
 * Port over a field extractor (ADR-0003). Given a document's OCR text and the
 * field schema for its type, returns the values it could pull. The MVP ships a
 * deterministic mock; a real LLM adapter drops in behind the same port.
 */
export abstract class FieldExtractor {
  abstract extract(input: ExtractInput): Promise<ExtractedFieldValue[]>;
}
