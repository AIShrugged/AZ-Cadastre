import { describe, expect, it } from "vitest";

import {
  CrossCheckMustCompareTwoDocumentsException,
  InvalidCrossCheckKeyException,
} from "../exceptions/index.js";
import { Confidence } from "./confidence.vo.js";
import { CrossCheckVerdict } from "./cross-check-verdict.vo.js";
import { CheckedValue, CrossCheck, CrossCheckKey } from "./cross-check.vo.js";
import { DocumentType } from "./document-type.vo.js";
import { FieldKey, FieldValue } from "./field.vo.js";
import { DocumentId } from "./ids.vo.js";
import { PageNumber } from "./page-number.vo.js";

const CARD = "0190a1b2-c3d4-7e5f-8a9b-000000000001";
const APPLICATION = "0190a1b2-c3d4-7e5f-8a9b-000000000002";

function aValue(
  documentId: string,
  type: string,
  field: string,
  value: string,
  page = 1,
  confidence = 0.9,
): CheckedValue {
  return CheckedValue.of({
    documentId: DocumentId.of(documentId),
    documentType: DocumentType.create(type),
    fieldKey: FieldKey.create(field),
    value: FieldValue.create(value),
    foundOn: PageNumber.of(page),
    confidence: Confidence.of(confidence),
  });
}

function aCheck(values: readonly CheckedValue[]): CrossCheck {
  return CrossCheck.of({
    key: CrossCheckKey.create("applicant_identity"),
    verdict: CrossCheckVerdict.MISMATCH,
    confidence: Confidence.of(0.7),
    note: "  the surnames differ  ",
    values,
  });
}

const CARD_SURNAME = aValue(CARD, "identity_card", "last_name", "ƏLİYEV", 2);
const APPLICANT = aValue(
  APPLICATION,
  "application",
  "applicant_name",
  "Məmmədov Elçin",
  1,
);

describe("CrossCheckKey", () => {
  it("refuses a key with nothing in it", () => {
    expect(() => CrossCheckKey.create("   ")).toThrow(
      InvalidCrossCheckKeyException,
    );
  });

  it("refuses a key longer than the column that stores it", () => {
    expect(() =>
      CrossCheckKey.create("x".repeat(CrossCheckKey.MAX_LENGTH + 1)),
    ).toThrow(InvalidCrossCheckKeyException);
  });

  it("is the same key however it was spaced", () => {
    expect(
      CrossCheckKey.create(" applicant_identity ").equals(
        CrossCheckKey.create("applicant_identity"),
      ),
    ).toBe(true);
  });
});

describe("CheckedValue", () => {
  it("cites the document, the field, the value and the sheet it sits on", () => {
    expect(CARD_SURNAME.cited).toBe(
      'identity_card.last_name "ƏLİYEV" (p.2)',
    );
  });

  it("knows the document it was read off", () => {
    expect(CARD_SURNAME.isFrom(DocumentId.of(CARD))).toBe(true);
    expect(CARD_SURNAME.isFrom(DocumentId.of(APPLICATION))).toBe(false);
  });
});

describe("CrossCheck", () => {
  it("refuses to be made over one document, which compares nothing", () => {
    const given = aValue(CARD, "identity_card", "first_name", "RÜBABƏ", 2);

    expect(() => aCheck([CARD_SURNAME, given])).toThrow(
      CrossCheckMustCompareTwoDocumentsException,
    );
  });

  it("refuses to be made over no values at all", () => {
    expect(() => aCheck([])).toThrow(CrossCheckMustCompareTwoDocumentsException);
  });

  it("is anchored on the value the profile named first", () => {
    const check = aCheck([CARD_SURNAME, APPLICANT]);

    expect(check.anchor).toBe(CARD_SURNAME);
  });

  it("cites every value it weighed, in the order it weighed them", () => {
    expect(aCheck([CARD_SURNAME, APPLICANT]).cited).toBe(
      'identity_card.last_name "ƏLİYEV" (p.2), ' +
        'application.applicant_name "Məmmədov Elçin" (p.1)',
    );
  });

  it("takes the note as one line, whatever whitespace it arrived in", () => {
    expect(aCheck([CARD_SURNAME, APPLICANT]).note).toBe("the surnames differ");
  });

  it("sends anything but an agreement to the inspector", () => {
    expect(aCheck([CARD_SURNAME, APPLICANT]).needsInspector).toBe(true);
  });

  it("keeps the values it was made over, not the array it was handed", () => {
    const values = [CARD_SURNAME, APPLICANT];
    const check = aCheck(values);

    values.pop();

    expect(check.values).toHaveLength(2);
  });

  it("comes back from storage with a side its documents no longer answer for", () => {
    const restored = CrossCheck.restore({
      key: CrossCheckKey.create("applicant_identity"),
      verdict: CrossCheckVerdict.MATCH,
      confidence: Confidence.of(0.9),
      note: "",
      values: [CARD_SURNAME],
    });

    expect(restored.values).toHaveLength(1);
    expect(restored.agrees).toBe(true);
  });
});
