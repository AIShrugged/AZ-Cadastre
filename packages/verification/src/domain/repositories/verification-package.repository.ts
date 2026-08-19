import type { VerificationPackage } from '../aggregates/index.js';
import type { PackageId } from '../value-objects/index.js';

export abstract class VerificationPackageRepository {
  abstract save(verificationPackage: VerificationPackage): Promise<void>;

  abstract findById(id: PackageId): Promise<VerificationPackage | null>;
}
