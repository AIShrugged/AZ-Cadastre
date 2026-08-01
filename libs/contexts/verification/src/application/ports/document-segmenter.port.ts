import type {
  DocumentTypeSpec,
  PageNumber,
  PageRange,
  RecognisedText,
} from "../../domain/value-objects/index.js";

export type ReadPage = {
  number: PageNumber;
  text: RecognisedText;
};

export type SegmentationRequest = {
  pages: readonly ReadPage[];
  // What the profile expects to find in the file. Where a document ends is
  // largely the question of what the next one starts being, so the boundary
  // call reads better for knowing the kinds in play.
  candidates: readonly DocumentTypeSpec[];
};

// Where one document ends and the next begins inside a single uploaded file.
// The ranges must tile the file — the aggregate refuses a set that leaves a
// sheet out or claims one twice — and the type each segment turns out to be is
// the classifier's answer, not this port's.
export abstract class DocumentSegmenter {
  abstract segment(request: SegmentationRequest): Promise<readonly PageRange[]>;
}
