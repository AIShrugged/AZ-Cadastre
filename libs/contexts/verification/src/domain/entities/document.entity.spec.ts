import { describe, expect, it } from "vitest";

import {
  DocumentAlreadyClassifiedException,
  DocumentAlreadySplitException,
  DocumentMustHaveAPageException,
  DocumentNotClassifiedException,
  DuplicatePageNumberException,
  PageNotInDocumentException,
  UnclassifiableDocumentException,
} from "../exceptions/index.js";
import {
  Classification,
  Confidence,
  ContentType,
  DocumentId,
  DocumentType,
  FieldKey,
  FieldValue,
  Filename,
  OcrResult,
  PageId,
  PageNumber,
  RecognisedText,
  StorageKey,
} from "../value-objects/index.js";
import { Document } from "./document.entity.js";
import { ExtractedField } from "./extracted-field.entity.js";
import { Page } from "./page.entity.js";

let sequence = 0;

function anId(): string {
  sequence += 1;
  return `0190a1b2-c3d4-7e5f-8a9b-${sequence.toString(16).padStart(12, "0")}`;
}

function aDocument(): Document {
  return Document.create(
    DocumentId.of(anId()),
    Filename.create("passport.pdf"),
    ContentType.PDF,
    StorageKey.create(`uploads/${anId()}.pdf`),
  );
}

function aPage(number: number): Page {
  return Page.create(
    PageId.of(anId()),
    PageNumber.of(number),
    StorageKey.create(`pages/${anId()}.png`),
  );
}

function anOcrResult(text: string): OcrResult {
  return OcrResult.of(RecognisedText.of(text), Confidence.of(0.9));
}

function aClassification(type = "passport"): Classification {
  return Classification.of(DocumentType.create(type), Confidence.of(0.87));
}

function aField(key: string): ExtractedField {
  return ExtractedField.of(
    FieldKey.create(key),
    FieldValue.create("AZE1234567"),
    Confidence.of(0.8),
    PageNumber.first(),
  );
}

describe("Document", () => {
  describe("when it is uploaded", () => {
    it("starts with the file it arrived as and nothing learned about it yet", () => {
      const id = DocumentId.of(anId());
      const filename = Filename.create("deed.pdf");
      const storageKey = StorageKey.create("uploads/deed.pdf");

      const document = Document.create(
        id,
        filename,
        ContentType.PDF,
        storageKey,
      );

      expect(document.id.equals(id)).toBe(true);
      expect(document.filename.equals(filename)).toBe(true);
      expect(document.contentType).toBe(ContentType.PDF);
      expect(document.storageKey.equals(storageKey)).toBe(true);
      expect(document.pages).toEqual([]);
      expect(document.fields).toEqual([]);
      expect(document.classification).toBeNull();
      expect(document.isSplit).toBe(false);
      expect(document.isClassified).toBe(false);
      expect(document.hasFields).toBe(false);
    });
  });

  describe("when it is rebuilt from storage", () => {
    it("holds its pages in reading order however the rows arrived", () => {
      const document = Document.restore({
        id: DocumentId.of(anId()),
        filename: Filename.create("deed.pdf"),
        contentType: ContentType.PDF,
        storageKey: StorageKey.create("uploads/deed.pdf"),
        pages: [aPage(3), aPage(1), aPage(2)],
        classification: null,
        fields: [],
      });

      expect(document.pages.map((page) => page.number.value)).toEqual([1, 2, 3]);
    });

    it("keeps everything the pipeline had already learned", () => {
      const classification = aClassification();

      const document = Document.restore({
        id: DocumentId.of(anId()),
        filename: Filename.create("passport.pdf"),
        contentType: ContentType.PDF,
        storageKey: StorageKey.create("uploads/passport.pdf"),
        pages: [aPage(1)],
        classification,
        fields: [aField("passport_no")],
      });

      expect(document.classification).toBe(classification);
      expect(document.isClassified).toBe(true);
      expect(document.hasFields).toBe(true);
    });
  });

  describe("splitting into pages", () => {
    it("records the sheets the file was rendered into", () => {
      const split = aDocument().splitInto([aPage(1), aPage(2)]);

      expect(split.pages).toHaveLength(2);
      expect(split.isSplit).toBe(true);
    });

    it("leaves the document it was split from alone", () => {
      const document = aDocument();

      document.splitInto([aPage(1), aPage(2)]);

      expect(document.pages).toEqual([]);
      expect(document.isSplit).toBe(false);
    });

    it("refuses a second split, so page ids stay stable and their OCR is never orphaned", () => {
      const split = aDocument().splitInto([aPage(1)]);

      expect(() => split.splitInto([aPage(1), aPage(2)])).toThrow(
        DocumentAlreadySplitException,
      );
    });

    it("refuses a split into no pages at all", () => {
      expect(() => aDocument().splitInto([])).toThrow(
        DocumentMustHaveAPageException,
      );
    });

    it("stays unsplit when it refuses an empty split, so the next attempt is still allowed", () => {
      const document = aDocument();

      expect(() => document.splitInto([])).toThrow(
        DocumentMustHaveAPageException,
      );

      expect(document.isSplit).toBe(false);
      expect(document.splitInto([aPage(1)]).pages).toHaveLength(1);
    });

    it("keeps the pages of the first split when it refuses a second", () => {
      const first = aDocument().splitInto([aPage(1)]);

      expect(() => first.splitInto([aPage(1), aPage(2)])).toThrow(
        DocumentAlreadySplitException,
      );

      expect(first.pages).toHaveLength(1);
    });

    it("refuses two sheets claiming the same place in the document", () => {
      const document = aDocument();

      expect(() =>
        document.splitInto([aPage(1), aPage(2), aPage(2)]),
      ).toThrow(DuplicatePageNumberException);
    });

    it("names the sheet it refuses to hold twice", () => {
      const document = aDocument();

      expect(() => document.splitInto([aPage(1), aPage(1)])).toThrow(
        /already has a page 1/,
      );
    });

    it("changes nothing when it refuses a duplicated sheet", () => {
      const document = aDocument();

      expect(() => document.splitInto([aPage(1), aPage(1)])).toThrow(
        DuplicatePageNumberException,
      );

      expect(document.pages).toEqual([]);
      expect(document.isSplit).toBe(false);
    });
  });

  describe("looking a page up", () => {
    it("finds a page of its own", () => {
      const page = aPage(1);
      const split = aDocument().splitInto([page]);

      expect(split.pageWith(page.id).id.equals(page.id)).toBe(true);
    });

    it("refuses a page that belongs to another document", () => {
      const split = aDocument().splitInto([aPage(1)]);
      const stranger = aPage(1);

      expect(() => split.pageWith(stranger.id)).toThrow(
        PageNotInDocumentException,
      );
    });
  });

  describe("recording what OCR read", () => {
    it("records the reading against the page named and no other", () => {
      const [first, second] = [aPage(1), aPage(2)];
      const split = aDocument().splitInto([first, second]);

      const read = split.recognised(first.id, anOcrResult("page one"));

      expect(read.pageWith(first.id).ocr?.text.value).toBe("page one");
      expect(read.pageWith(second.id).ocr).toBeNull();
    });

    it("leaves the document it was read from alone", () => {
      const page = aPage(1);
      const split = aDocument().splitInto([page]);

      split.recognised(page.id, anOcrResult("page one"));

      expect(split.pageWith(page.id).ocr).toBeNull();
    });

    it("refuses a page that belongs to another document", () => {
      const split = aDocument().splitInto([aPage(1)]);
      const stranger = aPage(1);

      expect(() =>
        split.recognised(stranger.id, anOcrResult("page one")),
      ).toThrow(PageNotInDocumentException);
    });

    it("counts the pages OCR has still to read", () => {
      const [first, second, third] = [aPage(1), aPage(2), aPage(3)];
      const split = aDocument().splitInto([first, second, third]);

      const read = split.recognised(second.id, anOcrResult("page two"));

      expect(read.unrecognisedPages.map((page) => page.number.value)).toEqual([
        1, 3,
      ]);
    });

    it("is fully recognised once every page has been read", () => {
      const [first, second] = [aPage(1), aPage(2)];
      const read = aDocument()
        .splitInto([first, second])
        .recognised(first.id, anOcrResult("page one"))
        .recognised(second.id, anOcrResult("page two"));

      expect(read.unrecognisedPages).toEqual([]);
      expect(read.isFullyRecognised).toBe(true);
    });

    it("is not fully recognised while a page is still unread", () => {
      const [first, second] = [aPage(1), aPage(2)];
      const read = aDocument()
        .splitInto([first, second])
        .recognised(first.id, anOcrResult("page one"));

      expect(read.isFullyRecognised).toBe(false);
    });

    it("is not fully recognised before it has been split at all", () => {
      const document = aDocument();

      expect(document.unrecognisedPages).toEqual([]);
      expect(document.isFullyRecognised).toBe(false);
    });

    it("counts a page OCR read nothing off as read", () => {
      const page = aPage(1);
      const read = aDocument()
        .splitInto([page])
        .recognised(page.id, OcrResult.illegible());

      expect(read.isFullyRecognised).toBe(true);
    });
  });

  describe("the text handed to the classifier", () => {
    it("is every page's reading joined in order", () => {
      const [first, second] = [aPage(1), aPage(2)];
      const read = aDocument()
        .splitInto([first, second])
        .recognised(first.id, anOcrResult("page one"))
        .recognised(second.id, anOcrResult("page two"));

      expect(read.text.value).toBe("page one\npage two");
    });

    it("skips a page OCR has not reached yet", () => {
      const [first, second, third] = [aPage(1), aPage(2), aPage(3)];
      const read = aDocument()
        .splitInto([first, second, third])
        .recognised(first.id, anOcrResult("page one"))
        .recognised(third.id, anOcrResult("page three"));

      expect(read.text.value).toBe("page one\npage three");
    });

    it("skips a page OCR read nothing off, rather than leaving a gap", () => {
      const [first, second] = [aPage(1), aPage(2)];
      const read = aDocument()
        .splitInto([first, second])
        .recognised(first.id, OcrResult.illegible())
        .recognised(second.id, anOcrResult("page two"));

      expect(read.text.value).toBe("page two");
    });

    it("reads as nothing for a document that has not been split", () => {
      expect(aDocument().text.isEmpty).toBe(true);
    });

    it("reads as nothing for a document no page of which has been read", () => {
      const split = aDocument().splitInto([aPage(1), aPage(2)]);

      expect(split.text.isEmpty).toBe(true);
    });

    it("is in page order however the sheets were handed over", () => {
      const [second, first] = [aPage(2), aPage(1)];
      const read = aDocument()
        .splitInto([second, first])
        .recognised(first.id, anOcrResult("page one"))
        .recognised(second.id, anOcrResult("page two"));

      expect(read.text.value).toBe("page one\npage two");
    });
  });

  describe("recording the type the classifier chose", () => {
    it("records the decision", () => {
      const classification = aClassification();

      const classified = aDocument().classifiedAs(classification);

      expect(classified.classification).toBe(classification);
      expect(classified.isClassified).toBe(true);
    });

    it("records a document the classifier could not place, which is a real outcome", () => {
      const classified = aDocument().classifiedAs(
        Classification.unplaced(Confidence.of(0.2)),
      );

      expect(classified.isClassified).toBe(true);
      expect(classified.classification?.isPlaced).toBe(false);
    });

    it("leaves the document it was classified from alone", () => {
      const document = aDocument();

      document.classifiedAs(aClassification());

      expect(document.classification).toBeNull();
      expect(document.isClassified).toBe(false);
    });

    it("refuses a second classification rather than silently changing the type", () => {
      const classified = aDocument().classifiedAs(aClassification("passport"));

      expect(() => classified.classifiedAs(aClassification("title_deed"))).toThrow(
        DocumentAlreadyClassifiedException,
      );
    });

    it("names the type it was already classified as when it refuses", () => {
      const classified = aDocument().classifiedAs(aClassification("passport"));

      expect(() =>
        classified.classifiedAs(aClassification("title_deed")),
      ).toThrow(/already classified as "passport"/);
    });

    it("keeps the first decision when it refuses a second", () => {
      const first = aClassification("passport");
      const classified = aDocument().classifiedAs(first);

      expect(() => classified.classifiedAs(aClassification("title_deed"))).toThrow(
        DocumentAlreadyClassifiedException,
      );

      expect(classified.classification).toBe(first);
    });

    it("refuses a second classification even of an unplaced document", () => {
      const classified = aDocument().classifiedAs(
        Classification.unplaced(Confidence.of(0.2)),
      );

      expect(() => classified.classifiedAs(aClassification())).toThrow(
        DocumentAlreadyClassifiedException,
      );
    });
  });

  describe("recording the fields pulled out", () => {
    it("records the values", () => {
      const withFields = aDocument()
        .classifiedAs(aClassification())
        .withFields([aField("passport_no"), aField("first_name")]);

      expect(withFields.fields.map((field) => field.key.value)).toEqual([
        "passport_no",
        "first_name",
      ]);
      expect(withFields.hasFields).toBe(true);
    });

    it("replaces the values wholesale, so re-extraction overwrites rather than accumulates", () => {
      const extracted = aDocument()
        .classifiedAs(aClassification())
        .withFields([aField("passport_no"), aField("first_name")]);

      const reExtracted = extracted.withFields([aField("passport_no")]);

      expect(reExtracted.fields.map((field) => field.key.value)).toEqual([
        "passport_no",
      ]);
    });

    it("records that nothing was found without keeping what was found before", () => {
      const extracted = aDocument()
        .classifiedAs(aClassification())
        .withFields([aField("passport_no")]);

      const reExtracted = extracted.withFields([]);

      expect(reExtracted.fields).toEqual([]);
      expect(reExtracted.hasFields).toBe(false);
    });

    it("leaves the document the fields were pulled from alone", () => {
      const classified = aDocument().classifiedAs(aClassification());

      classified.withFields([aField("passport_no")]);

      expect(classified.fields).toEqual([]);
    });

    it("refuses a document that has not been classified", () => {
      expect(() => aDocument().withFields([aField("passport_no")])).toThrow(
        DocumentNotClassifiedException,
      );
    });

    it("refuses a document the classifier could not place, because it declares no fields", () => {
      const unplaced = aDocument().classifiedAs(
        Classification.unplaced(Confidence.of(0.2)),
      );

      expect(() => unplaced.withFields([aField("passport_no")])).toThrow(
        UnclassifiableDocumentException,
      );
    });

    it("changes nothing when it refuses an unclassified document", () => {
      const document = aDocument();

      expect(() => document.withFields([aField("passport_no")])).toThrow(
        DocumentNotClassifiedException,
      );

      expect(document.fields).toEqual([]);
      expect(document.hasFields).toBe(false);
    });

    it("leaves the fields it already holds alone when it refuses", () => {
      const unplaced = aDocument().classifiedAs(
        Classification.unplaced(Confidence.of(0.2)),
      );

      expect(() => unplaced.withFields([aField("passport_no")])).toThrow(
        UnclassifiableDocumentException,
      );

      expect(unplaced.fields).toEqual([]);
    });
  });

  it("carries everything learned about it forward through each stage", () => {
    const page = aPage(1);
    const classification = aClassification();

    const document = aDocument()
      .splitInto([page])
      .recognised(page.id, anOcrResult("Republic of Azerbaijan"))
      .classifiedAs(classification)
      .withFields([aField("passport_no")]);

    expect(document.isFullyRecognised).toBe(true);
    expect(document.classification).toBe(classification);
    expect(document.hasFields).toBe(true);
    expect(document.text.value).toBe("Republic of Azerbaijan");
    expect(document.filename.value).toBe("passport.pdf");
  });
});

describe("Document as a holder of state", () => {
  it("copies the fields it is handed, so the caller cannot change them afterwards", () => {
    const fields = [aField("first_name")];
    const classified = aDocument().classifiedAs(aClassification());

    const withFields = classified.withFields(fields);
    fields.push(aField("last_name"));

    expect(withFields.fields).toHaveLength(1);
  });

  it("copies the pages it is handed, so the caller cannot change them afterwards", () => {
    const pages = [aPage(1)];

    const split = aDocument().splitInto(pages);
    pages.push(aPage(2));

    expect(split.pages).toHaveLength(1);
  });
});
