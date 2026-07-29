import { describe, expect, it } from "vitest";

import { DomainException } from "./domain.exception.js";

class ThingAlreadyDoneException extends DomainException {
  override readonly code = "THING_ALREADY_DONE";

  constructor(public readonly thingId: string) {
    super(`Thing ${thingId} has already been done`);
  }
}

describe("DomainException", () => {
  it("is an error, so it can be thrown and caught like one", () => {
    const refusal = new ThingAlreadyDoneException("42");

    expect(refusal).toBeInstanceOf(Error);
    expect(refusal).toBeInstanceOf(DomainException);
  });

  it("names itself after the rule that was refused", () => {
    expect(new ThingAlreadyDoneException("42").name).toBe(
      "ThingAlreadyDoneException",
    );
  });

  it("carries the stable code a client matches on", () => {
    expect(new ThingAlreadyDoneException("42").code).toBe("THING_ALREADY_DONE");
  });

  it("keeps the message it was given", () => {
    expect(new ThingAlreadyDoneException("42").message).toBe(
      "Thing 42 has already been done",
    );
  });

  it("carries no status: HTTP is a transport the domain knows nothing about", () => {
    expect("status" in new ThingAlreadyDoneException("42")).toBe(false);
  });

  it("is caught by class, so a refusal can be told from any other failure", () => {
    expect(() => {
      throw new ThingAlreadyDoneException("42");
    }).toThrow(ThingAlreadyDoneException);
  });
});
