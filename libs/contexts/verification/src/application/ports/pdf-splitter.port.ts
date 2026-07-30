import type {
  PageImage,
  PageNumber,
  StorageKey,
} from "../../domain/value-objects/index.js";

export type PdfSplitRequest = {
  storageKey: StorageKey;
};

export type SplitPage = {
  number: PageNumber;
  image: PageImage;
};

export abstract class PdfSplitter {
  abstract split(request: PdfSplitRequest): Promise<readonly SplitPage[]>;
}
