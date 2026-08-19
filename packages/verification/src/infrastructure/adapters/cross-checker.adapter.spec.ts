import { describe, expect, it } from "vitest";

import {
  CheckedValue,
  Confidence,
  CrossCheckSpec,
  CrossCheckVerdict,
  DocumentType,
  FieldKey,
  FieldValue,
  DocumentId,
  PageNumber,
  VerificationProfile,
} from "../../domain/value-objects/index.js";
import { CrossCheckerAdapter } from "./cross-checker.adapter.js";

const CARD = "0190a1b2-c3d4-7e5f-8a9b-000000000001";
const APPLICATION = "0190a1b2-c3d4-7e5f-8a9b-000000000002";

function aValue(
  documentId: string,
  type: string,
  field: string,
  value: string,
): CheckedValue {
  return CheckedValue.of({
    documentId: DocumentId.of(documentId),
    documentType: DocumentType.create(type),
    fieldKey: FieldKey.create(field),
    value: FieldValue.create(value),
    foundOn: PageNumber.first(),
    confidence: Confidence.of(0.9),
  });
}

function theIdentityCheck(): CrossCheckSpec {
  const [spec] = VerificationProfile.CADASTRE.crossChecks;

  return spec!;
}

async function verdictOver(
  values: readonly CheckedValue[],
): Promise<CrossCheckVerdict> {
  const answer = await new CrossCheckerAdapter().check({
    spec: theIdentityCheck(),
    values,
  });

  return answer.verdict;
}

describe("CrossCheckerAdapter", () => {
  it("reads one document's surname and given name as that document's one statement", async () => {
    const verdict = await verdictOver([
      aValue(CARD, "identity_card", "last_name", "ƏLİYEVA"),
      aValue(CARD, "identity_card", "first_name", "Rübabə"),
      aValue(APPLICATION, "application", "applicant_name", "Əliyeva Rübabə"),
    ]);

    expect(verdict).toBe(CrossCheckVerdict.MATCH);
  });

  it("forgives the case ending an application form attaches to the name", async () => {
    const verdict = await verdictOver([
      aValue(CARD, "identity_card", "last_name", "ƏLİYEVA"),
      aValue(CARD, "identity_card", "first_name", "Rübabə"),
      aValue(
        APPLICATION,
        "application",
        "applicant_name",
        "Əliyeva Rübabə Kavı qızına",
      ),
    ]);

    expect(verdict).toBe(CrossCheckVerdict.MATCH);
  });

  it("reports a different person as a disagreement", async () => {
    const verdict = await verdictOver([
      aValue(CARD, "identity_card", "last_name", "ƏLİYEV"),
      aValue(CARD, "identity_card", "first_name", "Elçin"),
      aValue(APPLICATION, "application", "applicant_name", "Məmmədov Elçin"),
    ]);

    expect(verdict).toBe(CrossCheckVerdict.MISMATCH);
  });

  it("says what each document stated, so a disagreement can be read", async () => {
    const answer = await new CrossCheckerAdapter().check({
      spec: theIdentityCheck(),
      values: [
        aValue(CARD, "identity_card", "last_name", "ƏLİYEV"),
        aValue(APPLICATION, "application", "applicant_name", "Məmmədov Elçin"),
      ],
    });

    expect(answer.note).toContain("ƏLİYEV");
    expect(answer.note).toContain("Məmmədov Elçin");
  });

  it("never answers that it could not tell: it compares, or it does not", async () => {
    const verdict = await verdictOver([
      aValue(CARD, "identity_card", "document_no", "AZE 12345678"),
      aValue(APPLICATION, "application", "applicant_document_no", "AZE12345678"),
    ]);

    expect(verdict).not.toBe(CrossCheckVerdict.UNCLEAR);
  });
});
