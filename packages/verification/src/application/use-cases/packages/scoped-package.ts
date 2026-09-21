import type { VerificationPackage } from '../../../domain/aggregates/index.js';
import {
  OwnerAccountId,
  type PackageId,
} from '../../../domain/value-objects/index.js';
import { PackageNotFoundException } from '../../exceptions/index.js';
import type { VerificationPackageRepository } from '../../ports/outbound/index.js';

/**
 * Loads a package a caller is allowed to have, and refuses identically whether
 * it is not there or not theirs.
 *
 * One function rather than the same four lines in every write, because the
 * mistake this guards against is a write that forgets them: a handler that
 * loaded the aggregate directly would add files to anybody's submission and
 * nothing would look wrong (ADR-0029).
 *
 * `ownerAccountId` is `null` for the office, which is scoped to nothing.
 */
export async function loadInScope(
  packages: VerificationPackageRepository,
  packageId: PackageId,
  ownerAccountId: string | null,
): Promise<VerificationPackage> {
  const verification = await packages.findById(packageId);

  if (!verification) throw new PackageNotFoundException(packageId);

  if (
    ownerAccountId !== null &&
    !verification.isOwnedBy(OwnerAccountId.of(ownerAccountId))
  ) {
    // Deliberately the same refusal as a package that does not exist: a 403 on
    // a case that does exist is a way to ask this system which of its ids are
    // real.
    throw new PackageNotFoundException(packageId);
  }

  return verification;
}
