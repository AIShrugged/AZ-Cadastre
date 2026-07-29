import type { ExtractedField } from "../../domain/entities/index.js";
import type {
  DocumentType,
  FieldSchema,
  RecognisedText,
} from "../../domain/value-objects/index.js";

export type ExtractionRequest = {
  text: RecognisedText;
  documentType: DocumentType;
  schema: FieldSchema;
};

export abstract class FieldExtractor {
  abstract extract(
    request: ExtractionRequest,
  ): Promise<readonly ExtractedField[]>;
}
