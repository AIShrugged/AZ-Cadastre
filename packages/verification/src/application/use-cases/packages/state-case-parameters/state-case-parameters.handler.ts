import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import {
  EditorAccountId,
  PackageId,
} from '../../../../domain/value-objects/index.js';
import { PackageNotFoundException } from '../../../exceptions/index.js';
import { VerificationPackageRepository } from '../../../ports/outbound/index.js';

import { StateCaseParametersCommand } from './state-case-parameters.command.js';

@CommandHandler(StateCaseParametersCommand)
export class StateCaseParametersHandler implements ICommandHandler<
  StateCaseParametersCommand,
  PackageId
> {
  constructor(
    @Inject(VerificationPackageRepository)
    private readonly packages: VerificationPackageRepository,
  ) {}

  async execute(command: StateCaseParametersCommand): Promise<PackageId> {
    const packageId = PackageId.of(command.packageId);
    const verification = await this.packages.findById(packageId);

    if (!verification) throw new PackageNotFoundException(packageId);

    /*
     * Whether the package is in a state that takes a statement, whether each
     * figure is one the parameter can take and whether anything actually
     * changed are all the aggregate's to say — the same division a correction
     * is made under.
     *
     * Saving is skipped where nothing changed, and that is not an optimisation:
     * a save would bump the version and publish the event that starts a run, so
     * an operator pressing save twice would re-verify a package that has been
     * re-verified since the first press (ADR-0033).
     */
    if (
      verification.stateCaseParameters(
        command.parameters,
        EditorAccountId.of(command.editedByAccountId),
      )
    ) {
      await this.packages.save(verification);
    }

    return verification.id;
  }
}
