import { Command } from '@nestjs/cqrs';

import type { PackageId } from '../../../../domain/value-objects/index.js';

/**
 * A person's approval of what the archive register answered about a submission.
 *
 * Two texts and no author: there are no accounts in this system, so there is
 * nobody to attribute it to, and a name the caller typed would be the
 * appearance of accountability rather than the thing (ADR-0016). When accounts
 * arrive the author comes off the request rather than out of the body.
 */
export class ApproveArchiveSearchCommand extends Command<PackageId> {
  constructor(
    public readonly packageId: string,
    // What the archive search means for the submission as a whole.
    public readonly summary: string,
    // A remark on the act of approving; absent where the person had none.
    public readonly comment: string | undefined,
  ) {
    super();
  }
}
