import { UnsupportedContentTypeException } from "../exceptions/index.js";

export class ContentType {
  static readonly PDF = new ContentType("application/pdf");
  static readonly JPEG = new ContentType("image/jpeg");
  static readonly PNG = new ContentType("image/png");

  private constructor(public readonly value: string) {}

  // A getter, so it cannot be read before the static instances exist.
  static get all(): readonly ContentType[] {
    return [ContentType.PDF, ContentType.JPEG, ContentType.PNG];
  }

  static of(raw: string): ContentType {
    const found = ContentType.all.find(
      (candidate) => candidate.value === raw,
    );

    if (!found) throw new UnsupportedContentTypeException(raw);

    return found;
  }

  get splitsIntoPages(): boolean {
    return this.equals(ContentType.PDF);
  }

  equals(other: ContentType): boolean {
    return this.value === other.value;
  }
}
