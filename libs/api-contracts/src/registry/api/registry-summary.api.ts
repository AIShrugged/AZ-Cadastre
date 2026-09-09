import type { RegistrySummaryResponse } from '../dto/index.js';

/**
 * What the register holds, asked of the register itself rather than of a
 * property.
 *
 * It takes no request: there is one archive and nothing to narrow the question
 * to, and a summary that had to be parameterised would be a search.
 */
export interface RegistrySummaryApi {
  get(): Promise<RegistrySummaryResponse>;
}
