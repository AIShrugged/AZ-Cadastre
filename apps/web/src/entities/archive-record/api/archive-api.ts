/**
 * The archive register, as the browser reaches it.
 *
 * Both questions go through the gateway like everything else: both **are** in
 * the contract — `AddressesApi` and `RegistrySummaryApi` in
 * `@cadastre/api-contracts/registry` — and since COMM-55 and COMM-58 there is
 * an `/api` route over each, so the screen speaks to this system's own origin
 * and the register is not on the browser's map at all.
 *
 * What it does **not** do is restate the shapes: request and response are the
 * contract's own, and each answer is parsed through the contract's own Zod
 * schema, so the one place the two sides can drift — the wire — is checked
 * rather than assumed.
 *
 * Nothing here crosses to the register directly any more. The liveness probe
 * that used to (`GET /api/health` through the `/registry` proxy) is gone: the
 * summary answers everything it answered and more, because a register that
 * publishes what it holds is by definition answering. `/registry` stays for the
 * workbook import, which is its last user (TECH_DEBT §10).
 */
import { api } from '@/shared/api';
import {
  AddressLookupResponseSchema,
  RegistrySummaryResponseSchema,
  type AddressLookupRequest,
  type AddressLookupResponse,
  type RegistrySummaryResponse,
} from '@cadastre/api-contracts/registry';

export const archiveApi = api.injectEndpoints({
  endpoints: build => ({
    /*
     * An ordinary endpoint on the shared base query now, and that is the whole
     * of the change: the request is the cache key, so a lookup already made
     * comes back without a call, and a refusal arrives as the same `ErrorBody`
     * every other refusal does.
     *
     * A POST and not a GET, because the register makes it one: the address is
     * somebody's property and has no business in a URL, a query string or an
     * access log.
     */
    lookupAddress: build.query<AddressLookupResponse, AddressLookupRequest>({
      query: request => ({
        url: '/addresses/lookup',
        method: 'POST',
        body: request,
      }),
      // Parsed and not cast: the gateway hands the register's answer through
      // untouched, so a register that has drifted from the contract has to fail
      // here rather than render as `undefined` in a panel.
      transformResponse: (response: unknown): AddressLookupResponse =>
        AddressLookupResponseSchema.parse(response),
    }),
    /*
     * How much of the archive the register is holding, and since when.
     *
     * The sidebar's one standing question, and it is two questions answered by
     * one call: what the archive has in it, and — by the call succeeding at
     * all — whether the archive is there. A separate health check beside this
     * would ask something this already proves.
     *
     * A refusal is not caught here. The gateway states a register that is down
     * as `REGISTRY_UNREACHABLE` (504) and one that refused us as
     * `REGISTRY_REFUSED` (502), both in the published `ErrorBody`, and the band
     * reads either as the register being quiet — but a parse failure is a
     * drifted contract and has to surface as one, not as a silent register.
     */
    archiveSummary: build.query<RegistrySummaryResponse, void>({
      query: () => '/registry/summary',
      transformResponse: (response: unknown): RegistrySummaryResponse =>
        RegistrySummaryResponseSchema.parse(response),
    }),
  }),
});

export const { useLookupAddressQuery, useArchiveSummaryQuery } = archiveApi;
