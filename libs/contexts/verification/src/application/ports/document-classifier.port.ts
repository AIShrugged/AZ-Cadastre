import type {
  Classification,
  DocumentType,
  RecognisedText,
} from "../../domain/value-objects/index.js";

export type ClassificationRequest = {
  text: RecognisedText;
  candidateTypes: readonly DocumentType[];
};

export abstract class DocumentClassifier {
  abstract classify(request: ClassificationRequest): Promise<Classification>;
}
