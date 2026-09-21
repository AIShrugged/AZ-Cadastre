import { describe, expect, it } from 'vitest';

import { VerificationPackage } from '../../../domain/aggregates/index.js';
import { SourceFile } from '../../../domain/entities/index.js';
import {
  ContentType,
  DeclaredAtIntake,
  Filename,
  OwnerAccountId,
  PackageId,
  SourceFileId,
  StorageKey,
  VerificationProfile,
} from '../../../domain/value-objects/index.js';
import { PackageNotFoundException } from '../../exceptions/index.js';
import type { VerificationPackageRepository } from '../../ports/outbound/index.js';

import { loadInScope } from './scoped-package.js';

const PACKAGE = PackageId.of('11111111-1111-4111-8111-111111111111');
const MINE = '22222222-2222-4222-8222-222222222222';
const THEIRS = '33333333-3333-4333-8333-333333333333';

function aPackage(owner: string | null): VerificationPackage {
  return VerificationPackage.create(
    PACKAGE,
    VerificationProfile.of('cadastre'),
    [
      SourceFile.create(
        SourceFileId.of('44444444-4444-4444-8444-444444444444'),
        Filename.create('technical-passport.pdf'),
        ContentType.of('application/pdf'),
        StorageKey.create('packages/one/technical-passport.pdf'),
      ),
    ],
    DeclaredAtIntake.none(),
    OwnerAccountId.orNone(owner),
  );
}

function repositoryHolding(
  verification: VerificationPackage | null,
): VerificationPackageRepository {
  return {
    findById: async () => verification,
    save: async () => undefined,
  } as VerificationPackageRepository;
}

/*
 * The refusal an applicant gets for somebody else's submission, proved where it
 * is decided rather than only over HTTP: a 404 and never a 403, because a 403
 * on a case that exists tells a stranger it exists (ADR-0029).
 */
describe('loadInScope', () => {
  it('hands the office any package, owned or not', async () => {
    await expect(
      loadInScope(repositoryHolding(aPackage(THEIRS)), PACKAGE, null),
    ).resolves.toBeInstanceOf(VerificationPackage);
    await expect(
      loadInScope(repositoryHolding(aPackage(null)), PACKAGE, null),
    ).resolves.toBeInstanceOf(VerificationPackage);
  });

  it('hands an applicant their own', async () => {
    await expect(
      loadInScope(repositoryHolding(aPackage(MINE)), PACKAGE, MINE),
    ).resolves.toBeInstanceOf(VerificationPackage);
  });

  it('refuses somebody else’s as one that does not exist', async () => {
    await expect(
      loadInScope(repositoryHolding(aPackage(THEIRS)), PACKAGE, MINE),
    ).rejects.toBeInstanceOf(PackageNotFoundException);
  });

  it('refuses an unowned package to an applicant, rather than making it everybody’s', async () => {
    // Every submission taken in before there were accounts has no owner. It
    // belongs to the office, and the office's scope is null — not to whoever
    // asks first.
    await expect(
      loadInScope(repositoryHolding(aPackage(null)), PACKAGE, MINE),
    ).rejects.toBeInstanceOf(PackageNotFoundException);
  });

  it('refuses one that is not there, in the same words', async () => {
    await expect(
      loadInScope(repositoryHolding(null), PACKAGE, MINE),
    ).rejects.toBeInstanceOf(PackageNotFoundException);
    await expect(
      loadInScope(repositoryHolding(null), PACKAGE, null),
    ).rejects.toBeInstanceOf(PackageNotFoundException);
  });
});
