import { PageAlreadyRecognisedException } from "../exceptions/index.js";
import {
  type OcrResult,
  PageId,
  type PageNumber,
  type StorageKey,
} from "../value-objects/index.js";

export class Page {
  private constructor(
    public readonly id: PageId,
    public readonly number: PageNumber,
    public readonly imageStorageKey: StorageKey,
    public readonly ocr: OcrResult | null,
  ) {}

  static create(
    id: PageId,
    number: PageNumber,
    imageStorageKey: StorageKey,
  ): Page {
    return new Page(id, number, imageStorageKey, null);
  }

  static restore(
    id: PageId,
    number: PageNumber,
    imageStorageKey: StorageKey,
    ocr: OcrResult | null,
  ): Page {
    return new Page(id, number, imageStorageKey, ocr);
  }

  get isRecognised(): boolean {
    return this.ocr !== null;
  }

  recognised(ocr: OcrResult): Page {
    if (this.isRecognised) {
      throw new PageAlreadyRecognisedException(this.id.value);
    }

    return new Page(this.id, this.number, this.imageStorageKey, ocr);
  }
}
