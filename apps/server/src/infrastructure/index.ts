import type { Provider } from "@nestjs/common";
import { VerificationClientPort } from "@cadastre/api-gateway";
import { VerificationApiPort } from "@cadastre/verification";

/**
 * Every cross-boundary port binding in the system, and the only place any of
 * them is made.
 *
 * This file is the extraction seam. When a context becomes its own service,
 * `useExisting` becomes an RPC client here and nothing under `packages/` moves.
 * If extracting one would need a change anywhere else, the boundary is wrong.
 */
export const LOCAL_PROVIDERS: Provider[] = [
  // gateway → verification
  { provide: VerificationClientPort, useExisting: VerificationApiPort },
];
