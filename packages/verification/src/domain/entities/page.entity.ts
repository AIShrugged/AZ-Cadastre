import { PageAlreadyRecognisedException } from "../exceptions/index.js";
import {
  type OcrResult,
  PageId,
  type PageImage,
  type PageNumber,
} from "../value-objects/index.js";

export class Page {
  private constructor(
    public readonly id: PageId,
    public readonly number: PageNumber,
    public readonly image: PageImage,
    public readonly ocr: OcrResult | null,
  ) {}

  static create(id: PageId, number: PageNumber, image: PageImage): Page {
    return new Page(id, number, image, null);
  }

  static restore(
    id: PageId,
    number: PageNumber,
    image: PageImage,
    ocr: OcrResult | null,
  ): Page {
    return new Page(id, number, image, ocr);
  }

  get isRecognised(): boolean {
    return this.ocr !== null;
  }

  recognised(ocr: OcrResult): Page {
    if (this.isRecognised) {
      throw new PageAlreadyRecognisedException(this.id.value);
    }

    return new Page(this.id, this.number, this.image, ocr);
  }
}
