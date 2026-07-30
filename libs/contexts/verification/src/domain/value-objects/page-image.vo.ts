import type { ContentType } from "./content-type.vo.js";
import type { StorageKey } from "./storage-key.vo.js";

export class PageImage {
  private constructor(
    public readonly storageKey: StorageKey,
    public readonly contentType: ContentType,
  ) {}

  static of(storageKey: StorageKey, contentType: ContentType): PageImage {
    return new PageImage(storageKey, contentType);
  }

  equals(other: PageImage): boolean {
    return (
      this.storageKey.equals(other.storageKey) &&
      this.contentType.equals(other.contentType)
    );
  }
}
