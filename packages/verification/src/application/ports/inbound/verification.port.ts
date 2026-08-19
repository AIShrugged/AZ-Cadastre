import type { VerificationApi } from '@cadastre/api-contracts/verification';

/**
 * What this context offers, as a DI token. An abstract class rather than an
 * interface because the composition root has to bind a runtime value, and it
 * mirrors the contract interface so the compiler keeps the two honest.
 */
export abstract class VerificationApiPort implements VerificationApi {
  abstract readonly packages: VerificationApi['packages'];
  abstract readonly documents: VerificationApi['documents'];
  abstract readonly profiles: VerificationApi['profiles'];
}
