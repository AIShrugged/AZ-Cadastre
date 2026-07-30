import { describe, expect, it } from "vitest";

import { ContentType } from "./content-type.vo.js";
import { PageImage } from "./page-image.vo.js";
import { StorageKey } from "./storage-key.vo.js";

describe("PageImage", () => {
  it("keeps where the image is together with what format it is in", () => {
    const storageKey = StorageKey.create("uploads/pages/page_001.png");

    const image = PageImage.of(storageKey, ContentType.PNG);

    expect(image.storageKey.equals(storageKey)).toBe(true);
    expect(image.contentType.equals(ContentType.PNG)).toBe(true);
  });

  it("is the same image as another naming the same object in the same format", () => {
    const first = PageImage.of(
      StorageKey.create("uploads/pages/page_001.png"),
      ContentType.PNG,
    );
    const second = PageImage.of(
      StorageKey.create("uploads/pages/page_001.png"),
      ContentType.PNG,
    );

    expect(first.equals(second)).toBe(true);
  });

  it("is a different image when it names a different object", () => {
    const first = PageImage.of(
      StorageKey.create("uploads/pages/page_001.png"),
      ContentType.PNG,
    );
    const second = PageImage.of(
      StorageKey.create("uploads/pages/page_002.png"),
      ContentType.PNG,
    );

    expect(first.equals(second)).toBe(false);
  });

  it("is a different image when the same object is read as another format", () => {
    const storageKey = StorageKey.create("uploads/scan");

    expect(
      PageImage.of(storageKey, ContentType.PNG).equals(
        PageImage.of(storageKey, ContentType.JPEG),
      ),
    ).toBe(false);
  });
});
