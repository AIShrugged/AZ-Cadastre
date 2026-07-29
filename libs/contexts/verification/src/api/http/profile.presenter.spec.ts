import { ProfileDtoSchema } from "@cadastre/contracts";
import { describe, expect, it } from "vitest";

import type { ProfileView } from "../../application/read-models/index.js";
import { toProfileDto } from "./profile.presenter.js";

function aProfileView(overrides: Partial<ProfileView> = {}): ProfileView {
  return {
    key: "cadastre",
    documentTypes: ["passport", "application", "title_deed"],
    ...overrides,
  };
}

describe("toProfileDto", () => {
  it("carries the key across unchanged, because it is what a package is created with", () => {
    const dto = toProfileDto(aProfileView({ key: "demo" }));

    expect(dto.key).toBe("demo");
  });

  it("renders the document types in the order the profile declared them", () => {
    const dto = toProfileDto(
      aProfileView({
        documentTypes: ["passport", "driver_license", "application"],
      }),
    );

    expect(dto.documentTypes).toEqual([
      "passport",
      "driver_license",
      "application",
    ]);
  });

  it("copies the types rather than handing out the read model's own array", () => {
    const view = aProfileView();

    const dto = toProfileDto(view);
    dto.documentTypes.push("forged");

    expect(view.documentTypes).toEqual([
      "passport",
      "application",
      "title_deed",
    ]);
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
