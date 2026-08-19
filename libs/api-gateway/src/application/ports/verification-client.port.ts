import type { VerificationApi } from "@cadastre/api-contracts/verification";

/**
 * How the edge reaches the verification context: the slices it actually calls,
 * and nothing more. Typed by the contracts package, bound in the composition
 * root — so making verification a separate service changes the binding there
 * and nothing here.
 */
export abstract class VerificationClientPort {
  abstract readonly packages: VerificationApi["packages"];
  abstract readonly documents: VerificationApi["documents"];
  abstract readonly profiles: VerificationApi["profiles"];
}
