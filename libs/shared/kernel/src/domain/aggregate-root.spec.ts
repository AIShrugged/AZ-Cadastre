import { describe, expect, it } from "vitest";

import { AggregateRoot } from "./aggregate-root.js";
import { DomainEvent } from "./domain-event.js";
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

class ThingCreated extends DomainEvent {
  override readonly type = "test.ThingCreated";

  constructor(public readonly thingId: ThingId) {
    super();
  }
}

class ThingRenamed extends DomainEvent {
  override readonly type = "test.ThingRenamed";

  constructor(
    public readonly thingId: ThingId,
    public readonly name: string,
  ) {
    super();
  }
}

class Thing extends AggregateRoot<ThingId> {
  #name: string;

  private constructor(id: ThingId, version: number, name: string) {
    super(id, version);
    this.#name = name;
  }

  static create(id: ThingId, name: string): Thing {
    const thing = new Thing(id, 0, name);
    thing.apply(new ThingCreated(id));

    return thing;
  }

  static restore(id: ThingId, version: number, name: string): Thing {
    return new Thing(id, version, name);
  }

  get name(): string {
    return this.#name;
  }

  rename(name: string): void {
    this.#name = name;
    this.apply(new ThingRenamed(this.id, name));
  }
}

function aThing(): Thing {
  return Thing.create(ThingId.of(anId()), "Original");
}

describe("AggregateRoot", () => {
  it("carries the id and version it was built with", () => {
    const id = ThingId.of(anId());

    const restored = Thing.restore(id, 7, "Restored");

    expect(restored.id.equals(id)).toBe(true);
    expect(restored.version).toBe(7);
  });

  it("records the event a creation applies", () => {
    const thing = aThing();

    expect(thing.getUncommittedEvents()).toHaveLength(1);
    expect(thing.getUncommittedEvents()[0]).toBeInstanceOf(ThingCreated);
  });

  it("records nothing when restored from storage", () => {
    const restored = Thing.restore(ThingId.of(anId()), 3, "Restored");

    expect(restored.getUncommittedEvents()).toEqual([]);
  });

  it("keeps events in the order they were applied", () => {
    const thing = aThing();
    thing.rename("Second");
    thing.rename("Third");

    expect(
      thing.getUncommittedEvents().map((event) => event.type),
    ).toEqual(["test.ThingCreated", "test.ThingRenamed", "test.ThingRenamed"]);
  });

  it("reads the uncommitted events without clearing them", () => {
    const thing = aThing();

    expect(thing.getUncommittedEvents()).toHaveLength(1);
    expect(thing.getUncommittedEvents()).toHaveLength(1);
    expect(thing.getUncommittedEvents()).toHaveLength(1);
  });

  it("forgets the events when they are committed", () => {
    const thing = aThing();
    thing.rename("Second");

    thing.commit();

    expect(thing.getUncommittedEvents()).toEqual([]);
  });

  it("leaves the events already handed over alone when it commits", () => {
    const thing = aThing();
    const handedOver = thing.getUncommittedEvents();

    thing.commit();

    expect(handedOver).toHaveLength(1);
  });

  it("records again after a commit", () => {
    const thing = aThing();
    thing.commit();

    thing.rename("Second");

    expect(thing.getUncommittedEvents()).toHaveLength(1);
    expect(thing.getUncommittedEvents()[0]).toBeInstanceOf(ThingRenamed);
  });

  it("cannot publish: handing events over belongs to the repository", () => {
    const thing = aThing();

    expect("publish" in thing).toBe(false);
  });
});
