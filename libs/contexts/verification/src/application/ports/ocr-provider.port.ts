import type {
  OcrResult,
  PageImage,
} from "../../domain/value-objects/index.js";

export abstract class OcrProvider {
  // How many pages this provider will read at once. The pipeline reads a
  // document's pages in parallel up to this width; what that width can be is the
  // provider's own business — its rate limits, not the use case's.
  abstract readonly pagesAtOnce: number;

  abstract recognise(image: PageImage): Promise<OcrResult>;
}
