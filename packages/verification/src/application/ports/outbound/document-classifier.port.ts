import type {
  Classification,
  DocumentTypeSpec,
  RecognisedText,
} from '../../../domain/value-objects/index.js';

export type ClassificationRequest = {
  text: RecognisedText;
  // The whole specification, not just the type keys: a classifier shown only
  // "license" and "license_annex" has nothing to tell them apart by.
  candidates: readonly DocumentTypeSpec[];
};

export abstract class DocumentClassifier {
  abstract classify(request: ClassificationRequest): Promise<Classification>;
}
