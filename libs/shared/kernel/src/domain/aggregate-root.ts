import type { DomainEvent } from "./domain-event.js";
import type { EntityId } from "./entity-id.js";

export abstract class AggregateRoot<TEntityId extends EntityId> {
  #events: DomainEvent[] = [];

  protected constructor(
    public readonly id: TEntityId,
    // Part of the WHERE clause of every update.
    public readonly version: number,
  ) {}

  protected apply(event: DomainEvent): void {
    this.#events.push(event);
  }

  getUncommittedEvents(): readonly DomainEvent[] {
    return this.#events;
  }

  commit(): void {
    this.#events = [];
  }
}
