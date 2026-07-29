import { describe, expect, it } from "vitest";

import { UnknownProfileException } from "../exceptions/index.js";
import { DocumentType } from "./document-type.vo.js";
import { FieldKey } from "./field.vo.js";
import { VerificationProfile } from "./verification-profile.vo.js";

describe("VerificationProfile", () => {
  it("accepts each profile the system is shipped with", () => {
    expect(VerificationProfile.of("demo")).toBe(VerificationProfile.DEMO);
    expect(VerificationProfile.of("cadastre")).toBe(
      VerificationProfile.CADASTRE,
    );
  });

  it("refuses a padded key, because a profile key is matched and never tidied", () => {
    expect(() => VerificationProfile.of("  cadastre  ")).toThrow(
      UnknownProfileException,
    );
  });

  it("refuses a profile the system does not ship", () => {
    expect(() => VerificationProfile.of("mortgage")).toThrow(
      UnknownProfileException,
    );
  });

  it("refuses an empty profile key", () => {
    expect(() => VerificationProfile.of("")).toThrow(UnknownProfileException);
    expect(() => VerificationProfile.of("   ")).toThrow(UnknownProfileException);
  });

  it("says which key it was asked for when it refuses", () => {
    expect(() => VerificationProfile.of("mortgage")).toThrow(/"mortgage"/);
  });

  it("lists every profile it ships, in the order they are offered", () => {
    expect(VerificationProfile.all.map((profile) => profile.key)).toEqual([
      "cadastre",
      "demo",
    ]);
  });

  describe("the types a package of its kind is made of", () => {
    it("names them in report order", () => {
      expect(
        VerificationProfile.CADASTRE.documentTypes.map((type) => type.value),
      ).toEqual(["passport", "application", "title_deed", "cadastral_extract"]);
    });

    it("names a different set for a different profile", () => {
      expect(
        VerificationProfile.DEMO.documentTypes.map((type) => type.value),
      ).toEqual(["passport", "driver_license", "application"]);
    });

    it("never offers the classifier a type it cannot place", () => {
      expect(
        VerificationProfile.CADASTRE.documentTypes.every(
          (type) => type.isKnown,
        ),
      ).toBe(true);
    });
  });

  describe("recognising a type", () => {
    it("recognises a type it declares", () => {
      expect(
        VerificationProfile.CADASTRE.recognises(DocumentType.create("title_deed")),
      ).toBe(true);
    });

    it("does not recognise a type another profile declares", () => {
      expect(
        VerificationProfile.CADASTRE.recognises(
          DocumentType.create("driver_license"),
        ),
      ).toBe(false);
    });

    it("does not recognise a type no profile declares", () => {
      expect(
        VerificationProfile.CADASTRE.recognises(DocumentType.create("invoice")),
      ).toBe(false);
    });

    it("does not recognise the type of a document that could not be placed", () => {
      expect(VerificationProfile.CADASTRE.recognises(DocumentType.UNKNOWN)).toBe(
        false,
      );
    });
  });

  describe("the schema of a type", () => {
    it("declares what to pull from a document of that type", () => {
      const schema = VerificationProfile.CADASTRE.schemaFor(
        DocumentType.create("title_deed"),
      );

      expect(schema.specs.map((spec) => spec.key.value)).toEqual([
        "owner_name",
        "parcel_id",
        "issue_date",
      ]);
    });

    it("labels each field for the human who reads it", () => {
      const schema = VerificationProfile.CADASTRE.schemaFor(
        DocumentType.create("cadastral_extract"),
      );

      expect(schema.specs.map((spec) => spec.label)).toEqual([
        "Parcel ID",
        "Area",
        "Registry date",
      ]);
    });

    it("declares the keys of that type and no others", () => {
      const schema = VerificationProfile.CADASTRE.schemaFor(
        DocumentType.create("passport"),
      );

      expect(schema.declares(FieldKey.create("passport_no"))).toBe(true);
      expect(schema.declares(FieldKey.create("parcel_id"))).toBe(false);
    });

    it("declares nothing for a type it does not recognise", () => {
      const schema = VerificationProfile.CADASTRE.schemaFor(
        DocumentType.create("driver_license"),
      );

      expect(schema.isEmpty).toBe(true);
      expect(schema.declares(FieldKey.create("license_no"))).toBe(false);
    });

    it("declares nothing for a document that could not be placed", () => {
      expect(
        VerificationProfile.CADASTRE.schemaFor(DocumentType.UNKNOWN).isEmpty,
      ).toBe(true);
    });

    it("lets two profiles declare the same type their own way", () => {
      expect(
        VerificationProfile.DEMO.schemaFor(DocumentType.create("passport"))
          .specs.length,
      ).toBe(
        VerificationProfile.CADASTRE.schemaFor(DocumentType.create("passport"))
          .specs.length,
      );
      expect(
        VerificationProfile.DEMO.recognises(DocumentType.create("driver_license")),
      ).toBe(true);
      expect(
        VerificationProfile.CADASTRE.recognises(
          DocumentType.create("driver_license"),
        ),
      ).toBe(false);
    });
  });

  it("is equal to another handle on the same profile", () => {
    expect(
      VerificationProfile.CADASTRE.equals(VerificationProfile.of("cadastre")),
    ).toBe(true);
    expect(VerificationProfile.CADASTRE.equals(VerificationProfile.DEMO)).toBe(
      false,
    );
  });
});
