import { randomUUID } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { hash, hashSync, verify } from '@node-rs/argon2';

import { PasswordHasher } from '../../application/ports/outbound/index.js';
import { PasswordHash } from '../../domain/value-objects/index.js';

/**
 * argon2id, at the parameters OWASP names as its first option: 19 MiB of
 * memory, two passes, one lane.
 *
 * Written here rather than read from the environment. A cost parameter a
 * deployment can lower is a cost parameter that will be lowered — by a machine
 * with less memory than the one it was tuned on, quietly, with every password
 * written afterwards cheaper to attack and nothing saying so. Raising it is a
 * change to this file, a commit and a review; the encoded digest carries its own
 * parameters, so rows written under the old ones go on verifying.
 */
/*
 * `2` is `Algorithm.Argon2id`, written as the number it is: the library
 * declares that enum as an ambient `const enum`, which `isolatedModules` — this
 * repository's setting, and the one that lets a file be transpiled without its
 * neighbours — cannot read at all.
 */
const ARGON2ID = 2;

const OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19 * 1024,
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class Argon2PasswordHasher extends PasswordHasher {
  /**
   * A digest of a value nobody has, computed once when the container is built.
   *
   * Computed rather than written down because it has to cost exactly what a
   * real digest costs to check — that is the whole point of it — and a literal
   * pasted here is one somebody eventually shortens. Synchronous on purpose:
   * it has to exist before the first request rather than on the way to
   * answering one, and it is the only argon2 call in this class that blocks.
   */
  override readonly unmatchableHash: PasswordHash = PasswordHash.of(
    hashSync(`${randomUUID()}${randomUUID()}`, OPTIONS),
  );

  override async hash(password: string): Promise<PasswordHash> {
    return PasswordHash.of(await hash(password, OPTIONS));
  }

  override async verify(
    stored: PasswordHash,
    password: string,
  ): Promise<boolean> {
    try {
      /*
       * The parameters are not passed: they are encoded in the digest, and a
       * row written before they were raised must go on verifying under the ones
       * it was written with.
       */
      return await verify(stored.value, password);
    } catch {
      /*
       * A digest this build cannot read — written by an algorithm we no longer
       * run, or a column somebody edited by hand. That is a credential that no
       * longer verifies, not a fault of the request, so it is `false` and the
       * caller gets the one refusal a sign-in has.
       */
      return false;
    }
  }
}
