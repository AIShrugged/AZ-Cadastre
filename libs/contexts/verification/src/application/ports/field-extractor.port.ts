import type { ExtractedField } from "../../domain/entities/index.js";
import type {
  Confidence,
  DocumentTypeSpec,
  PageImage,
  PageNumber,
  RecognisedText,
} from "../../domain/value-objects/index.js";

// One sheet of the document, as both of the things it is: the picture the
// reader was handed and what the reader made of it. An extractor worth the name
// wants both — a card number the transcription lost is still legible in the
// scan, and the scan alone leaves it nothing to quote back as evidence.
export type ExtractionSheet = {
  number: PageNumber;
  image: PageImage;
  text: RecognisedText;
  // How well the sheet was read. A value cannot be surer than the reading it
  // was taken from, and the extractor is the last place that knows both.
  read: Confidence;
};

export type ExtractionRequest = {
  text: RecognisedText;
  sheets: readonly ExtractionSheet[];
  // What kind of document this is and which fields it declares. The schema
  // alone names the keys to look for, not the paper they are printed on.
  spec: DocumentTypeSpec;
};

export abstract class FieldExtractor {
  abstract extract(
    request: ExtractionRequest,
  ): Promise<readonly ExtractedField[]>;
}
