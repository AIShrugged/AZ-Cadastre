import { describe, expect, it } from "vitest";

import { RecognisedText } from "./recognised-text.vo.js";

describe("RecognisedText", () => {
  it("keeps whatever OCR read, including its layout", () => {
    const raw = "  Republic of Azerbaijan\n  Passport  ";

    expect(RecognisedText.of(raw).value).toBe(raw);
  });

  it("accepts nothing at all, because an unreadable page genuinely produces none", () => {
    expect(RecognisedText.of("").value).toBe("");
  });

  it("reads a page that yielded nothing as an empty value, not as absence", () => {
    expect(RecognisedText.empty().value).toBe("");
    expect(RecognisedText.empty().isEmpty).toBe(true);
  });

  it("counts text that is nothing but whitespace as empty", () => {
    expect(RecognisedText.of("   \n\t ").isEmpty).toBe(true);
  });

  it("counts any readable character as not empty", () => {
    expect(RecognisedText.of(" A ").isEmpty).toBe(false);
  });

  describe("joining pages in reading order", () => {
    it("puts a newline between the two pages", () => {
      const joined = RecognisedText.of("page one").concat(
        RecognisedText.of("page two"),
      );

      expect(joined.value).toBe("page one\npage two");
    });

    it("skips a page that read as nothing rather than leaving a gap", () => {
      const joined = RecognisedText.of("page one").concat(
        RecognisedText.empty(),
      );

      expect(joined.value).toBe("page one");
    });

    it("skips a leading page that read as nothing", () => {
      const joined = RecognisedText.empty().concat(
        RecognisedText.of("page two"),
      );

      expect(joined.value).toBe("page two");
    });

    it("skips a page that read as whitespace alone", () => {
      const joined = RecognisedText.of("page one").concat(
        RecognisedText.of("   \n "),
      );

      expect(joined.value).toBe("page one");
    });

    it("yields nothing when neither page read as anything", () => {
      const joined = RecognisedText.empty().concat(RecognisedText.of("  "));

      expect(joined.isEmpty).toBe(true);
    });

    it("leaves both pages as they were", () => {
      const first = RecognisedText.of("page one");
      const second = RecognisedText.of("page two");

      first.concat(second);

      expect(first.value).toBe("page one");
      expect(second.value).toBe("page two");
    });

    it("joins three pages into one run in the order they were read", () => {
      const joined = RecognisedText.of("one")
        .concat(RecognisedText.of("two"))
        .concat(RecognisedText.of("three"));

      expect(joined.value).toBe("one\ntwo\nthree");
    });
  });

  it("is equal to other text reading exactly the same", () => {
    expect(RecognisedText.of("abc").equals(RecognisedText.of("abc"))).toBe(true);
    expect(RecognisedText.of("abc").equals(RecognisedText.of("abd"))).toBe(
      false,
    );
  });

  it("tells whitespace apart when comparing, even though it ignores it when asking about emptiness", () => {
    expect(RecognisedText.of(" ").equals(RecognisedText.empty())).toBe(false);
  });
});
