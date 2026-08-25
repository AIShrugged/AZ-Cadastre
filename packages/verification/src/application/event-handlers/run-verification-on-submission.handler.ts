import { Inject } from '@nestjs/common';
import { CommandBus, EventsHandler, type IEventHandler } from '@nestjs/cqrs';

import { Logger } from '@cadastre/logger';

import { PackageSubmitted } from '../../domain/events/index.js';
import { RunVerificationCommand } from '../use-cases/index.js';

@EventsHandler(PackageSubmitted)
export class RunVerificationOnSubmissionHandler implements IEventHandler<PackageSubmitted> {
  private readonly logger: Logger;

  constructor(
    private readonly commands: CommandBus,
    @Inject(Logger) logger: Logger,
  ) {
    this.logger = logger.child({
      scope: RunVerificationOnSubmissionHandler.name,
    });
  }

  handle(event: PackageSubmitted): void {
    // The request that submitted the package is answered before any of this
    // happens, so the line below is the only place the two are tied together.
    this.logger.log('Package submitted — starting verification', {
      packageId: event.packageId.value,
    });

    // The pipeline outlives the request that submitted the package, so nothing
    // waits on it: a failure lands on the package's own status, which is where
    // the inspector reads it.
    void this.commands
      .execute(new RunVerificationCommand(event.packageId.value))
      .catch((error: unknown) => {
        this.logger.error('Verification failed', {
          packageId: event.packageId.value,
          error,
        });
      });
  }
}
