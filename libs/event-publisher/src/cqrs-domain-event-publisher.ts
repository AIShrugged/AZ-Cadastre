import { Injectable } from '@nestjs/common';
import { EventBus } from '@nestjs/cqrs';

import {
  DomainEventPublisher,
  type AggregateRoot,
  type DomainEvent,
  type EntityId,
} from '@cadastre/shared';

/**
 * The in-process implementation of the kernel's publisher port: an aggregate's
 * uncommitted events go onto the Nest CQRS bus, in order, before the caller
 * continues.
 */
@Injectable()
export class CqrsDomainEventPublisher extends DomainEventPublisher {
  constructor(private readonly events: EventBus) {
    super();
  }

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
