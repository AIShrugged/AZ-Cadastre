import { describe, expect, it } from "vitest";

import {
  DocumentType,
  RecognisedText,
  VerificationProfile,
} from "../../domain/value-objects/index.js";
import { DocumentClassifierAdapter } from "./document-classifier.adapter.js";

const CADASTRE_TYPES = VerificationProfile.CADASTRE.documentTypes;

function classify(
  text: string,
  candidateTypes: readonly DocumentType[] = CADASTRE_TYPES,
) {
  return new DocumentClassifierAdapter().classify({
    text: RecognisedText.of(text),
    candidateTypes,
  });
}

const PASSPORT_TEXT = [
  "REPUBLIC OF AZERBAIJAN",
  "PASSPORT",
  "Surname / Soyad: ALIYEV",
  "Passport No: AZE1234567",
].join("\n");

const APPLICATION_TEXT = [
  "APPLICATION FORM",
  "Applicant: ELCHIN ALIYEV",
  "Passport No: AZE1234567",
  "Driver License No: AZ87654321",
].join("\n");

describe("DocumentClassifierAdapter", () => {
  it("picks the type whose keyword comes first, so an application form that cites a passport number is not read as a passport", async () => {
    const classification = await classify(APPLICATION_TEXT);

    expect(classification.type.value).toBe("application");
  });

  it("reads a passport as a passport", async () => {
    const classification = await classify(PASSPORT_TEXT);

    expect(classification.type.value).toBe("passport");
  });

  it("reads a title deed as a title deed, even though 'deed' also appears later", async () => {
    const classification = await classify(
      ["TITLE DEED", "Owner: ELCHIN ALIYEV", "Parcel ID: AZ-CAD-1024-311"].join("\n"),
    );

    expect(classification.type.value).toBe("title_deed");
  });

  it("reads a cadastral extract as a cadastral extract", async () => {
    const classification = await classify(
      ["CADASTRAL EXTRACT", "Parcel ID: AZ-CAD-1024-311", "Area: 642 m2"].join("\n"),
    );

    expect(classification.type.value).toBe("cadastral_extract");
  });

  it("ignores where the candidate sits in the list and looks only at where its keyword sits in the text", async () => {
    const [first, second] = [
      await classify(APPLICATION_TEXT, [
        DocumentType.create("passport"),
        DocumentType.create("application"),
      ]),
      await classify(APPLICATION_TEXT, [
        DocumentType.create("application"),
        DocumentType.create("passport"),
      ]),
    ];

    expect(first.type.value).toBe("application");
    expect(second.type.value).toBe("application");
  });

  it("reads the header rather than a cross-reference further down the page", async () => {
    const classification = await classify(
      [
        "DRIVER LICENSE",
        "Surname: ALIYEV",
        "See attached application form and passport",
      ].join("\n"),
      VerificationProfile.DEMO.documentTypes,
    );

    expect(classification.type.value).toBe("driver_license");
  });

  it("does not care how the text was cased", async () => {
    const classification = await classify("republic of azerbaijan\npassport");

    expect(classification.type.value).toBe("passport");
  });

  it("leaves the document unplaced when no candidate's keyword appears at all", async () => {
    const classification = await classify("A page with nothing distinguishing on it");

    expect(classification.isPlaced).toBe(false);
    expect(classification.type.equals(DocumentType.UNKNOWN)).toBe(true);
  });

  it("leaves a page OCR read nothing off unplaced", async () => {
    const classification = await classify("");

    expect(classification.isPlaced).toBe(false);
  });

  it("is sure of a keyword hit and unsure of a miss", async () => {
    const placed = await classify(PASSPORT_TEXT);
    const unplaced = await classify("nothing to go on here");

    expect(placed.confidence.value).toBe(0.94);
    expect(unplaced.confidence.value).toBe(0.3);
  });

  it("only ever answers with a type it was offered, or with none", async () => {
    const candidates = [
      DocumentType.create("title_deed"),
      DocumentType.create("cadastral_extract"),
    ];

    const answers = await Promise.all(
      [PASSPORT_TEXT, APPLICATION_TEXT, "DRIVER LICENSE", "TITLE DEED", "nothing here"].map(
        (text) => classify(text, candidates),
      ),
    );

    for (const answer of answers) {
      expect(
        candidates.some((candidate) => candidate.equals(answer.type)) ||
          answer.type.equals(DocumentType.UNKNOWN),
      ).toBe(true);
    }
  });

  it("leaves a passport unplaced when the profile does not expect passports", async () => {
    const classification = await classify(PASSPORT_TEXT, [
      DocumentType.create("title_deed"),
      DocumentType.create("cadastral_extract"),
    ]);

    expect(classification.isPlaced).toBe(false);
  });

  it("falls back to the type's own key, read as words, for a type it has no keywords for", async () => {
    const classification = await classify("BIRTH CERTIFICATE\nName: ELCHIN ALIYEV", [
      DocumentType.create("birth_certificate"),
    ]);

    expect(classification.type.value).toBe("birth_certificate");
  });
});
