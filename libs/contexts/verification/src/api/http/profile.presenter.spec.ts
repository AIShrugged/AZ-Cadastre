import { ProfileDtoSchema } from "@cadastre/contracts";
import { describe, expect, it } from "vitest";

import type { ProfileView } from "../../application/read-models/index.js";
import { toProfileDto } from "./profile.presenter.js";

function aProfileView(overrides: Partial<ProfileView> = {}): ProfileView {
  return {
    key: "cadastre",
    documentTypes: [
      { key: "land_plot_plan", required: true },
      { key: "identity_card", required: true },
      { key: "payment_receipt", required: true },
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
          { key: "payment_receipt", required: true },
          { key: "sketch_project", required: true },
          { key: "archive_certificate", required: false },
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
          { key: "identity_card", required: true },
          { key: "archive_certificate", required: false },
        ],
      }),
    );

    expect(dto.documentTypes).toEqual([
      { key: "identity_card", required: true },
      { key: "archive_certificate", required: false },
    ]);
  });

  it("copies the types rather than handing out the read model's own array", () => {
    const view = aProfileView();

    const dto = toProfileDto(view);
    dto.documentTypes.push({ key: "forged", required: true });

    expect(view.documentTypes).toHaveLength(3);
  });

  it("renders a profile that expects nothing as an empty list rather than leaving it out", () => {
    const dto = toProfileDto(aProfileView({ documentTypes: [] }));

    expect(dto.documentTypes).toEqual([]);
  });

  it("says nothing about the fields each type declares — a picker does not draw them", () => {
    const dto = toProfileDto(aProfileView());

    expect(Object.keys(dto)).toEqual(["key", "documentTypes"]);
  });

  it("answers a shape the published profile contract accepts", () => {
    const dto = toProfileDto(aProfileView());

    expect(ProfileDtoSchema.parse(dto)).toEqual(dto);
  });
});
