import { DomainEvent } from '@cadastre/shared';

import type { PackageId } from '../value-objects/index.js';

/**
 * An operator set one or more of the six figures the Article 8 table decides on
 * (COMM-193).
 *
 * The same shape of thing as a corrected field, with a narrower blast radius
 * still: nothing the papers state has changed, so every check across them
 * stands — but which provision the case falls under has, and with it which
 * papers the package is short of and every finding compiled against them. So
 * the package re-opens and is read again, on the road a correction takes, and
 * the report is compiled afresh rather than patched (ADR-0033).
 */
export class CaseParametersStated extends DomainEvent {
  override readonly type = 'verification.CaseParametersStated';

  constructor(
    public readonly packageId: PackageId,
    // How many of the six the operator set or cleared. Never zero: a statement
    // that changes nothing does not re-open the package and is not announced.
    public readonly parameterCount: number,
  ) {
    super();
  }
}
