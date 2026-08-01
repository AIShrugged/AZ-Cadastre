import type { ExtractedField } from "../../domain/entities/index.js";
import type {
  DocumentTypeSpec,
  RecognisedText,
} from "../../domain/value-objects/index.js";

export type ExtractionRequest = {
  text: RecognisedText;
  // What kind of document this is and which fields it declares. The schema
  // alone names the keys to look for, not the paper they are printed on.
  spec: DocumentTypeSpec;
};

export abstract class FieldExtractor {
  abstract extract(
    request: ExtractionRequest,
  ): Promise<readonly ExtractedField[]>;
}
