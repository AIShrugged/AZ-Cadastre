import { ProfileDtoSchema } from "@cadastre/contracts";
import { describe, expect, it } from "vitest";

import type { ProfileView } from "../../application/read-models/index.js";
import { toProfileDto } from "./profile.presenter.js";

function aProfileView(overrides: Partial<ProfileView> = {}): ProfileView {
  return {
    key: "cadastre",
    documentTypes: [
      { key: "land_plot_plan", required: true, fields: ["cadastral_number"] },
      { key: "identity_card", required: true, fields: ["document_no"] },
      { key: "payment_receipt", required: true, fields: [] },
    ],
    ...overrides,
  };
}

describe("toProfileDto", () => {
  it("carries the key across unchanged, because it is what a package is created with", () => {
    const dto = toProfileDto(aProfileView({ key: "mortgage" }));

    expect(dto.key).toBe("mortgage");
  });

  it("renders the document types in the order the profile declared them", () => {
    const dto = toProfileDto(
      aProfileView({
        documentTypes: [
          { key: "payment_receipt", required: true, fields: [] },
          { key: "sketch_project", required: true, fields: [] },
          { key: "archive_certificate", required: false, fields: [] },
        ],
      }),
    );

    expect(dto.documentTypes.map((type) => type.key)).toEqual([
      "payment_receipt",
      "sketch_project",
      "archive_certificate",
    ]);
  });

  it("says of each type whether a package is incomplete without it", () => {
    const dto = toProfileDto(
      aProfileView({
        documentTypes: [
          { key: "identity_card", required: true, fields: [] },
          { key: "archive_certificate", required: false, fields: [] },
        ],
      }),
    );

    expect(dto.documentTypes).toEqual([
      { key: "identity_card", required: true, fields: [] },
      { key: "archive_certificate", required: false, fields: [] },
    ]);
  });

  it("copies the types rather than handing out the read model's own array", () => {
    const view = aProfileView();

    const dto = toProfileDto(view);
    dto.documentTypes.push({ key: "forged", required: true, fields: [] });

    expect(view.documentTypes).toHaveLength(3);
  });

  it("copies each type's fields rather than handing out the read model's own array", () => {
    const view = aProfileView();

    const dto = toProfileDto(view);
    dto.documentTypes[0]?.fields.push("forged_field");

    expect(view.documentTypes[0]?.fields).toEqual(["cadastral_number"]);
  });

  it("renders a profile that expects nothing as an empty list rather than leaving it out", () => {
    const dto = toProfileDto(aProfileView({ documentTypes: [] }));

    expect(dto.documentTypes).toEqual([]);
  });

  it("names the fields each type declares, in the order the profile declared them", () => {
    const dto = toProfileDto(
      aProfileView({
        documentTypes: [
          {
            key: "application",
            required: true,
            fields: ["applicant_name", "property_address", "cadastral_number"],
          },
        ],
      }),
    );

    expect(dto.documentTypes[0]?.fields).toEqual([
      "applicant_name",
      "property_address",
      "cadastral_number",
    ]);
  });

  it("renders a type the profile extracts nothing from as an empty list, not a missing one", () => {
    const dto = toProfileDto(aProfileView());

    expect(dto.documentTypes[2]?.fields).toEqual([]);
  });

  it("says nothing else about a profile than its key and its types", () => {
    const dto = toProfileDto(aProfileView());

    expect(Object.keys(dto)).toEqual(["key", "documentTypes"]);
  });

  it("answers a shape the published profile contract accepts", () => {
    const dto = toProfileDto(aProfileView());

    expect(ProfileDtoSchema.parse(dto)).toEqual(dto);
  });
});
