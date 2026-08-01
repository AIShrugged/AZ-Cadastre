import { describe, expect, it } from "vitest";

import { VerificationProfile } from "../../domain/value-objects/index.js";
import { looksLike } from "./hint-matching.js";

const CADASTRE = VerificationProfile.CADASTRE.specs;

function typeOf(text: string): string | null {
  return looksLike(text, CADASTRE)?.type.value ?? null;
}

describe("looksLike", () => {
  it("finds the type whose heading the page carries", () => {
    expect(typeOf("Lisenziya No: AZ-LIC-2019-4471")).toBe("license");
  });

  it("reads a heading printed in capitals, dotted İ and all", () => {
    expect(typeOf("LİSENZİYA")).toBe("license");
    expect(typeOf("BİLDİRİŞ İCRAATI QAYDASINDA ƏRİZƏ")).toBe(
      "notification_application",
    );
  });

  it("reads a heading OCR stripped the diacritics off", () => {
    expect(typeOf("SEXSIYYET VESIQESI")).toBe("identity_card");
    expect(typeOf("LISENZIYAYA ELAVE")).toBe("license_annex");
  });

  it("reads the Russian heading as readily as the Azerbaijani one", () => {
    expect(typeOf("УДОСТОВЕРЕНИЕ ЛИЧНОСТИ")).toBe("identity_card");
  });

  it("takes the heading at the top over a type mentioned further down", () => {
    const text = [
      "DAŞINMAZ ƏMLAK ÜZƏRİNDƏ HÜQUQLARIN DÖVLƏT QEYDİYYATI HAQQINDA ƏRİZƏ",
      "Şəxsiyyət vəsiqəsi No: AZE1234567",
    ].join("\n");

    expect(typeOf(text)).toBe("registration_application");
  });

  it("takes the longer heading when two start in the same place", () => {
    expect(typeOf("LİSENZİYAYA ƏLAVƏ, Lisenziya No: AZ-LIC-2019-4471")).toBe(
      "license_annex",
    );
  });

  it("finds nothing on a page that names no type", () => {
    expect(typeOf("bir məktub")).toBeNull();
  });

  it("finds nothing on a page OCR read nothing off", () => {
    expect(typeOf("")).toBeNull();
  });

  it("offers only a type it was given", () => {
    const withoutLicense = CADASTRE.filter(
      (spec) => spec.type.value !== "license",
    );

    expect(looksLike("LİSENZİYA", withoutLicense)?.type.value).not.toBe(
      "license",
    );
  });
});
