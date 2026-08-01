import { describe, expect, it } from "vitest";

import { UnknownProfileException } from "../exceptions/index.js";
import { DocumentType } from "./document-type.vo.js";
import { FieldKey } from "./field.vo.js";
import { VerificationProfile } from "./verification-profile.vo.js";

const CADASTRE_TYPES = [
  "registration_application",
  "identity_card",
  "notification_application",
  "architectural_plan",
  "license",
  "license_annex",
];

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
      ).toEqual(CADASTRE_TYPES);
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

  describe("what a package must carry", () => {
    it("requires every document a cadastre submission is made of", () => {
      expect(
        VerificationProfile.CADASTRE.requiredTypes.map((type) => type.value),
      ).toEqual(CADASTRE_TYPES);
    });

    it("names only types it recognises as required", () => {
      for (const type of VerificationProfile.CADASTRE.requiredTypes) {
        expect(VerificationProfile.CADASTRE.recognises(type)).toBe(true);
      }
    });
  });

  describe("recognising a type", () => {
    it("recognises a type it declares", () => {
      expect(
        VerificationProfile.CADASTRE.recognises(DocumentType.create("license")),
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

  describe("what a classifier is told about a type", () => {
    it("describes each type it declares, so two like ones can be told apart", () => {
      for (const spec of VerificationProfile.CADASTRE.specs) {
        expect(spec.description.length).toBeGreaterThan(0);
        expect(spec.hints.length).toBeGreaterThan(0);
      }
    });

    it("tells the annex apart from the licence in its own description", () => {
      const annex = VerificationProfile.CADASTRE.specFor(
        DocumentType.create("license_annex"),
      );

      expect(annex.description).toMatch(/not the licence itself/i);
    });

    it("gives the headings in the languages the papers are written in", () => {
      const identity = VerificationProfile.CADASTRE.specFor(
        DocumentType.create("identity_card"),
      );

      expect(identity.hints).toContain("şəxsiyyət vəsiqəsi");
      expect(identity.hints).toContain("удостоверение личности");
    });

    it("says nothing about a type it does not recognise, and asks nothing of it", () => {
      const stray = VerificationProfile.CADASTRE.specFor(
        DocumentType.create("invoice"),
      );

      expect(stray.hints).toEqual([]);
      expect(stray.schema.isEmpty).toBe(true);
      expect(stray.isRequired).toBe(false);
    });
  });

  describe("the schema of a type", () => {
    it("declares what to pull from an identity card", () => {
      const schema = VerificationProfile.CADASTRE.schemaFor(
        DocumentType.create("identity_card"),
      );

      expect(schema.specs.map((spec) => spec.key.value)).toEqual([
        "first_name",
        "last_name",
        "document_no",
        "issue_date",
        "expiry_date",
      ]);
    });

    it("labels each field for the human who reads it", () => {
      const schema = VerificationProfile.CADASTRE.schemaFor(
        DocumentType.create("license"),
      );

      expect(schema.specs.map((spec) => spec.label)).toEqual([
        "Licence number",
        "Licence holder",
        "Licensed activity",
        "Issuing authority",
        "Issue date",
        "Expiration date",
      ]);
    });

    it("declares the keys of that type and no others", () => {
      const schema = VerificationProfile.CADASTRE.schemaFor(
        DocumentType.create("registration_application"),
      );

      expect(schema.declares(FieldKey.create("cadastral_number"))).toBe(true);
      expect(schema.declares(FieldKey.create("license_no"))).toBe(false);
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

    it("has the licence and its annex agree on the key that ties them together", () => {
      const license = VerificationProfile.CADASTRE.schemaFor(
        DocumentType.create("license"),
      );
      const annex = VerificationProfile.CADASTRE.schemaFor(
        DocumentType.create("license_annex"),
      );

      expect(license.declares(FieldKey.create("license_no"))).toBe(true);
      expect(annex.declares(FieldKey.create("license_no"))).toBe(true);
    });

    it("lets two profiles declare the same type their own way", () => {
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
