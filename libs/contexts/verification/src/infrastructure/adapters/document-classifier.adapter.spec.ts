import { describe, expect, it } from "vitest";

import {
  type DocumentTypeSpec,
  RecognisedText,
  VerificationProfile,
} from "../../domain/value-objects/index.js";
import { DocumentClassifierAdapter } from "./document-classifier.adapter.js";

const CADASTRE = VerificationProfile.CADASTRE.specs;

function classify(
  text: string,
  candidates: readonly DocumentTypeSpec[] = CADASTRE,
) {
  return new DocumentClassifierAdapter().classify({
    text: RecognisedText.of(text),
    candidates,
  });
}

const IDENTITY_TEXT = [
  "AZƏRBAYCAN RESPUBLİKASI",
  "ŞƏXSİYYƏT VƏSİQƏSİ",
  "Soyadı: ƏLİYEV",
  "Vəsiqə No: AZE1234567",
].join("\n");

const REGISTRATION_TEXT = [
  "DAŞINMAZ ƏMLAK ÜZƏRİNDƏ HÜQUQLARIN DÖVLƏT QEYDİYYATI HAQQINDA ƏRİZƏ",
  "Ərizəçi: ELÇİN ƏLİYEV",
  "Şəxsiyyət vəsiqəsi No: AZE1234567",
].join("\n");

describe("DocumentClassifierAdapter", () => {
  it("reads an identity card as an identity card", async () => {
    const classification = await classify(IDENTITY_TEXT);

    expect(classification.type.value).toBe("identity_card");
  });

  it("picks the heading over a cross-reference, so a registration application that cites an identity card is not read as one", async () => {
    const classification = await classify(REGISTRATION_TEXT);

    expect(classification.type.value).toBe("registration_application");
  });

  it("reads an application under the notification procedure as its own kind", async () => {
    const classification = await classify(
      [
        "BİLDİRİŞ İCRAATI QAYDASINDA ƏRİZƏ",
        "Ərizəçi: ELÇİN ƏLİYEV",
        "Kadastr nömrəsi: AZ-CAD-1024-311",
      ].join("\n"),
    );

    expect(classification.type.value).toBe("notification_application");
  });

  it("reads an architectural plan as an architectural plan", async () => {
    const classification = await classify(
      [
        "MEMARLIQ-PLANLAŞDIRMA HƏLLİ (ESKİZ LAYİHƏ)",
        'Layihə təşkilatı: "AzMemarLayihə" MMC',
      ].join("\n"),
    );

    expect(classification.type.value).toBe("architectural_plan");
  });

  it("reads a licence as a licence", async () => {
    const classification = await classify(
      ["LİSENZİYA", "Lisenziya No: AZ-LIC-2019-4471"].join("\n"),
    );

    expect(classification.type.value).toBe("license");
  });

  it("tells an annex from the licence it is an annex to", async () => {
    const classification = await classify(
      [
        "LİSENZİYAYA ƏLAVƏ",
        "Lisenziya No: AZ-LIC-2019-4471",
        "Əlavə No: 1",
      ].join("\n"),
    );

    expect(classification.type.value).toBe("license_annex");
  });

  it("tells a Russian annex from the licence too", async () => {
    const classification = await classify(
      ["ПРИЛОЖЕНИЕ К ЛИЦЕНЗИИ", "Лицензия No: AZ-LIC-2019-4471"].join("\n"),
    );

    expect(classification.type.value).toBe("license_annex");
  });

  it("reads a document written in Russian as readily as one in Azerbaijani", async () => {
    const classification = await classify(
      ["УДОСТОВЕРЕНИЕ ЛИЧНОСТИ", "Фамилия: АЛИЕВ"].join("\n"),
    );

    expect(classification.type.value).toBe("identity_card");
  });

  it("ignores where the candidate sits in the list and looks only at where its heading sits in the text", async () => {
    const reversed = [...CADASTRE].reverse();

    const classification = await classify(IDENTITY_TEXT, reversed);

    expect(classification.type.value).toBe("identity_card");
  });

  it("does not care how the text was cased", async () => {
    const classification = await classify(IDENTITY_TEXT.toLowerCase());

    expect(classification.type.value).toBe("identity_card");
  });

  it("leaves the document unplaced when no candidate's heading appears at all", async () => {
    const classification = await classify("A LETTER ABOUT NOTHING IN PARTICULAR");

    expect(classification.type.isKnown).toBe(false);
  });

  it("leaves a page OCR read nothing off unplaced", async () => {
    const classification = await classify("");

    expect(classification.type.isKnown).toBe(false);
  });

  it("is sure of a heading hit and unsure of a miss", async () => {
    const placed = await classify(IDENTITY_TEXT);
    const unplaced = await classify("nothing recognisable here");

    expect(placed.confidence.value).toBeGreaterThan(
      unplaced.confidence.value,
    );
  });

  it("only ever answers with a type it was offered, or with none", async () => {
    const offered = CADASTRE.map((spec) => spec.type.value);

    for (const text of [IDENTITY_TEXT, REGISTRATION_TEXT, "unrelated"]) {
      const classification = await classify(text);

      expect([...offered, "unknown"]).toContain(classification.type.value);
    }
  });

  it("leaves an identity card unplaced when the profile does not expect one", async () => {
    const withoutIdentity = CADASTRE.filter(
      (spec) => spec.type.value !== "identity_card",
    );

    const classification = await classify(IDENTITY_TEXT, withoutIdentity);

    expect(classification.type.value).not.toBe("identity_card");
  });
});
