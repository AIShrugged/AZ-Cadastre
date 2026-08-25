import type { AddressesApi } from './addresses.api.js';

/**
 * The whole published surface of the archive register, by area. A caller that
 * needs one area declares an outbound port over that slice alone.
 *
 * Today it is answered by a stand-in seeded from fixtures; the day a real
 * register answers it, this interface is what does not change (ADR-0009).
 */
export interface ArchiveRegistryApi {
  readonly addresses: AddressesApi;
}
