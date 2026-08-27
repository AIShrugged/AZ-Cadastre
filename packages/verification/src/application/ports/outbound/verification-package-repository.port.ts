import type { VerificationPackage } from '../../../domain/aggregates/index.js';
import type { PackageId } from '../../../domain/value-objects/index.js';

/**
 * Where the aggregate is kept, said in the aggregate's own words. It lives in
 * `application/ports` rather than beside the model because "store this package"
 * is something a use case needs, not something the package knows about itself:
 * the domain layer would have to name a collaborator it never calls.
 *
 * `save` takes the whole aggregate, not a diff — the aggregate is the
 * transactional boundary, and what it takes to write it is the adapter's
 * problem.
 */
export abstract class VerificationPackageRepository {
  abstract save(verificationPackage: VerificationPackage): Promise<void>;

  abstract findById(id: PackageId): Promise<VerificationPackage | null>;
}
