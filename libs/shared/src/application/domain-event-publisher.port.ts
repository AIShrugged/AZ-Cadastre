import type { AggregateRoot, EntityId } from '../domain/index.js';

/**
 * How a use case gets an aggregate's pending domain events out of it.
 *
 * The port lives in the kernel because every context means the same thing by
 * it; the implementation does not, so it lives in an adapter
 * (`@cadastre/event-publisher`) and the composition root binds the two. That is
 * what keeps the bottom of the stack free of a framework import.
 */
export abstract class DomainEventPublisher {
  abstract dispatch(aggregate: AggregateRoot<EntityId>): Promise<void>;
}
