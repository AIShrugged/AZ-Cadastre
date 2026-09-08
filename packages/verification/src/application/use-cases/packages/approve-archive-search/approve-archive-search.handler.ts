import { Inject } from '@nestjs/common';
import { CommandHandler, type ICommandHandler } from '@nestjs/cqrs';

import {
  ApprovalComment,
  ApprovalSummary,
  PackageId,
} from '../../../../domain/value-objects/index.js';
import { PackageNotFoundException } from '../../../exceptions/index.js';
import { VerificationPackageRepository } from '../../../ports/outbound/index.js';

import { ApproveArchiveSearchCommand } from './approve-archive-search.command.js';

@CommandHandler(ApproveArchiveSearchCommand)
export class ApproveArchiveSearchHandler implements ICommandHandler<
  ApproveArchiveSearchCommand,
  PackageId
> {
  constructor(
    @Inject(VerificationPackageRepository)
    private readonly packages: VerificationPackageRepository,
  ) {}

  async execute(command: ApproveArchiveSearchCommand): Promise<PackageId> {
    const packageId = PackageId.of(command.packageId);
    const verification = await this.packages.findById(packageId);

    if (!verification) throw new PackageNotFoundException(packageId);

    // Whether there is an archive search to approve, and whether one is
    // already approved, is the aggregate's to say: the state it is in is the
    // only thing that decides it, and that decision has one home (ADR-0016).
    verification.approveArchiveSearch(
      ApprovalSummary.create(command.summary),
      ApprovalComment.from(command.comment),
    );

    await this.packages.save(verification);

    return verification.id;
  }
}
