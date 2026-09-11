import { DomainException } from '@cadastre/shared';

/**
 * A file was sent in through the supply operation without saying what it
 * answers.
 *
 * The target is the whole difference between this and `addFiles` (COMM-80): it
 * is what the run holds the classification against and what decides whether the
 * gap was closed. A file without one would sit in the package with nothing ever
 * held to it, which is the silence targeted supply exists to end.
 */
export class UntargetedSupplyException extends DomainException {
  override readonly code = 'UNTARGETED_SUPPLY';

  constructor(public readonly packageId: string) {
    super(
      `A document supplied to package ${packageId} must say what it answers: ` +
        `the document type it is sent in as, and — where it replaces a scan ` +
        `that was read badly — the document it replaces`,
    );
  }
}
