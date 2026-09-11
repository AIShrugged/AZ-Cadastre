import { Inject } from '@nestjs/common';
import { CommandBus, EventsHandler, type IEventHandler } from '@nestjs/cqrs';

import { Logger } from '@cadastre/logger';

import {
  DocumentSupplied,
  FilesAdded,
  PackageSubmitted,
} from '../../domain/events/index.js';
import { RunVerificationCommand } from '../use-cases/index.js';

/**
 * All three events, because the answer to all three is the same one: files have
 * arrived at a package, so read it. A package that gains a file has already
 * discarded the report it had, and the run re-reads nothing it read before —
 * every stage skips what is already done (ADR-0013).
 *
 * A document sent in for one of the package's gaps is read by this same run and
 * not by a shorter one of its own: it is classified, its fields are extracted,
 * it is held against the papers already in the envelope, the register is asked
 * again, and the report is compiled afresh. That is what makes a supplied
 * required document go the whole way rather than merely being recognised
 * (COMM-80).
 */
@EventsHandler(PackageSubmitted, FilesAdded, DocumentSupplied)
export class RunVerificationOnNewFilesHandler implements IEventHandler<
  PackageSubmitted | FilesAdded | DocumentSupplied
> {
  private readonly logger: Logger;

  constructor(
    private readonly commands: CommandBus,
    @Inject(Logger) logger: Logger,
  ) {
    this.logger = logger.child({
      scope: RunVerificationOnNewFilesHandler.name,
    });
  }

  handle(event: PackageSubmitted | FilesAdded | DocumentSupplied): void {
    // The request that brought the files in is answered before any of this
    // happens, so the line below is the only place the two are tied together.
    this.logger.log('Files arrived at a package — starting verification', {
      packageId: event.packageId.value,
      because: event.type,
      files: event.fileCount,
    });

    // The pipeline outlives the request that brought the files, so nothing
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
