import { Injectable } from "@nestjs/common";
import { EventBus } from "@nestjs/cqrs";
import type { AggregateRoot, DomainEvent, EntityId } from "@cadastre/kernel";

@Injectable()
export class DomainEventDispatcher {
  constructor(private readonly events: EventBus) {}

  async dispatch(aggregate: AggregateRoot<EntityId>): Promise<void> {
    const pending = [...aggregate.getUncommittedEvents()];
    aggregate.commit();

    await this.publishAll(pending);
  }

  private async publishAll(events: readonly DomainEvent[]): Promise<void> {
    for (const event of events) {
      await this.events.publish(event);
    }
  }
}
