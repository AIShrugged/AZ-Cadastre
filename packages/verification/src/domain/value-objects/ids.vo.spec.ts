import { EntityId } from "@cadastre/shared";
import { describe, expect, it } from "vitest";

import { DocumentId, PackageId, PageId } from "./ids.vo.js";

let sequence = 0;

function anId(): string {
  sequence += 1;
  return `0190a1b2-c3d4-7e5f-8a9b-${sequence.toString(16).padStart(12, "0")}`;
}

describe("PackageId", () => {
  it("keeps the value it was given", () => {
    const value = anId();

    expect(PackageId.of(value).value).toBe(value);
  });

  it("is an identifier of the kernel's kind", () => {
    expect(PackageId.of(anId())).toBeInstanceOf(EntityId);
  });

  it("is equal to another package id naming the same package", () => {
    const value = anId();

    expect(PackageId.of(value).equals(PackageId.of(value))).toBe(true);
  });

  it("differs from a package id naming another package", () => {
    expect(PackageId.of(anId()).equals(PackageId.of(anId()))).toBe(false);
  });

  it("serialises as the bare value", () => {
    const value = anId();

    expect(JSON.stringify({ packageId: PackageId.of(value) })).toBe(
      `{"packageId":"${value}"}`,
    );
  });
});

describe("DocumentId", () => {
  it("keeps the value it was given", () => {
    const value = anId();

    expect(DocumentId.of(value).value).toBe(value);
  });

  it("is equal to another document id naming the same document", () => {
    const value = anId();

    expect(DocumentId.of(value).equals(DocumentId.of(value))).toBe(true);
  });
});

describe("PageId", () => {
  it("keeps the value it was given", () => {
    const value = anId();

    expect(PageId.of(value).value).toBe(value);
  });

  it("is equal to another page id naming the same page", () => {
    const value = anId();

    expect(PageId.of(value).equals(PageId.of(value))).toBe(true);
  });
});

describe("the ids of this context", () => {
  it("adds no runtime field for the nominal marker", () => {
    expect(Object.keys(PageId.of(anId()))).toEqual(["value"]);
  });

  it("validates nothing: an id has no rule of its own", () => {
    expect(DocumentId.of("").value).toBe("");
    expect(DocumentId.of("not-a-uuid").value).toBe("not-a-uuid");
  });
});
