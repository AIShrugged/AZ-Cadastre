import { Logger } from '@nestjs/common';
import { CommandBus, EventsHandler, type IEventHandler } from '@nestjs/cqrs';

import { PackageSubmitted } from '../../domain/events/index.js';
import { RunVerificationCommand } from '../use-cases/index.js';

@EventsHandler(PackageSubmitted)
export class RunVerificationOnSubmissionHandler implements IEventHandler<PackageSubmitted> {
  private readonly logger = new Logger(RunVerificationOnSubmissionHandler.name);

  constructor(private readonly commands: CommandBus) {}

  handle(event: PackageSubmitted): void {
    // The pipeline outlives the request that submitted the package, so nothing
    // waits on it: a failure lands on the package's own status, which is where
    // the inspector reads it.
    void this.commands
      .execute(new RunVerificationCommand(event.packageId.value))
      .catch((error: unknown) => {
        this.logger.error(
          `Verification of package ${event.packageId.value} failed: ${String(error)}`,
        );
      });
  }
}
