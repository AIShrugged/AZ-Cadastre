import type { AddressesApi } from './addresses.api.js';
import type { RegistrySummaryApi } from './registry-summary.api.js';

/**
 * The whole published surface of the archive register, by area. A caller that
 * needs one area declares an outbound port over that slice alone.
 *
 * Today it is answered by a stand-in seeded from fixtures; the day a real
 * register answers it, this interface is what does not change (ADR-0009).
 */
export interface ArchiveRegistryApi {
  readonly addresses: AddressesApi;
  /**
   * What the register holds, as opposed to what it holds about a property. It
   * is an area of the published contract and not a health check: a real state
   * register can say how much of the archive it answers for, and a caller that
   * shows an operator "six sources, 4 812 records" is asking the register that
   * question rather than asking whether a process is up.
   */
  readonly summary: RegistrySummaryApi;
}
