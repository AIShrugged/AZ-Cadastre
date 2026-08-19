import type { DocumentsApi } from './documents.api.js';
import type { PackagesApi } from './packages.api.js';
import type { ProfilesApi } from './profiles.api.js';

/**
 * The whole published surface of the verification context, by area. A caller
 * that needs one area declares an outbound port over that slice alone; nobody
 * declares a cross-context message anywhere but here.
 */
export interface VerificationApi {
  readonly packages: PackagesApi;
  readonly documents: DocumentsApi;
  readonly profiles: ProfilesApi;
}
