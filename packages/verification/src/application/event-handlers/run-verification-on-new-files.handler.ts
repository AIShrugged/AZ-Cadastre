import { Inject } from '@nestjs/common';
import { CommandBus, EventsHandler, type IEventHandler } from '@nestjs/cqrs';

import { Logger } from '@cadastre/logger';

import {
  DocumentFieldsEdited,
  DocumentSupplied,
  FilesAdded,
  PackageSubmitted,
} from '../../domain/events/index.js';
import { RunVerificationCommand } from '../use-cases/index.js';

/** The four ways a package comes to need reading again. */
type Reopened =
  PackageSubmitted | FilesAdded | DocumentSupplied | DocumentFieldsEdited;

/**
 * All four events, because the answer to all four is the same one: this package
 * has re-opened, so read it. A package that re-opens has already discarded
 * everything worked out across it, and the run re-reads nothing it read before
 * — every stage skips what is already done (ADR-0013).
 *
 * A document sent in for one of the package's gaps is read by this same run and
 * not by a shorter one of its own: it is classified, its fields are extracted,
 * it is held against the papers already in the envelope, the register is asked
 * again, and the report is compiled afresh. That is what makes a supplied
 * required document go the whole way rather than merely being recognised
 * (COMM-80).
 *
 * A field an operator corrected by hand is the same again, with a smaller blast
 * radius and the same road: the correction may be a side of any cross-document
 * check, and deciding here which checks it could reach would be a second copy
 * of a rule the aggregate already applied when it discarded them (COMM-122).
 */
@EventsHandler(
  PackageSubmitted,
  FilesAdded,
  DocumentSupplied,
  DocumentFieldsEdited,
)
export class RunVerificationOnNewFilesHandler implements IEventHandler<Reopened> {
  private readonly logger: Logger;

  constructor(
    private readonly commands: CommandBus,
    @Inject(Logger) logger: Logger,
  ) {
    this.logger = logger.child({
      scope: RunVerificationOnNewFilesHandler.name,
    });
  }

  handle(event: Reopened): void {
    // The request that re-opened the package is answered before any of this
    // happens, so the line below is the only place the two are tied together.
    this.logger.log('A package re-opened — starting verification', {
      packageId: event.packageId.value,
      because: event.type,
      // How much arrived, in the unit the event counts in: files for the three
      // that bring files, corrected keys for the one that brings none. Said as
      // two fields rather than one number whose meaning depends on `because`.
      files: event instanceof DocumentFieldsEdited ? 0 : event.fileCount,
      fields: event instanceof DocumentFieldsEdited ? event.fieldCount : 0,
    });

    // The pipeline outlives the request that brought the change, so nothing
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
