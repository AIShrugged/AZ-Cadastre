import { describe, expect, it } from "vitest";

import { EntityId } from "./entity-id.js";

let sequence = 0;

function anId(): string {
  sequence += 1;
  return `0190a1b2-c3d4-7e5f-8a9b-${sequence.toString(16).padStart(12, "0")}`;
}

class ThingId extends EntityId {
  declare private readonly __type: "ThingId";

  static of(value: string): ThingId {
    return new ThingId(value);
  }
}

class OtherId extends EntityId {
  declare private readonly __type: "OtherId";

  static of(value: string): OtherId {
    return new OtherId(value);
  }
}

describe("EntityId", () => {
  it("keeps the value it was given, whatever it looks like", () => {
    const value = anId();

    expect(ThingId.of(value).value).toBe(value);
  });

  it("validates nothing: an id has no rule of its own", () => {
    expect(ThingId.of("").value).toBe("");
    expect(ThingId.of("   ").value).toBe("   ");
  });

  it("is equal to another id carrying the same value", () => {
    const value = anId();

    expect(ThingId.of(value).equals(ThingId.of(value))).toBe(true);
  });

  it("differs from an id carrying another value", () => {
    expect(ThingId.of(anId()).equals(ThingId.of(anId()))).toBe(false);
  });

  it("reads as its value in a string", () => {
    const value = anId();

    expect(`${ThingId.of(value)}`).toBe(value);
    expect(ThingId.of(value).toString()).toBe(value);
  });

  it("serialises as the bare value rather than an object", () => {
    const value = anId();

    expect(JSON.stringify({ id: ThingId.of(value) })).toBe(
      `{"id":"${value}"}`,
    );
  });

  it("carries no runtime field for the nominal marker", () => {
    expect(Object.keys(ThingId.of(anId()))).toEqual(["value"]);
  });

  it("does not add a runtime rule to keep two kinds of id apart", () => {
    const value = anId();

    expect(ThingId.of(value).value).toBe(OtherId.of(value).value);
  });
});
