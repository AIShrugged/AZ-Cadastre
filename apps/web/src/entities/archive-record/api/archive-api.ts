/**
 * The archive register, as the browser reaches it.
 *
 * Every question goes through the gateway like everything else: all three
 * **are** in the contract — `AddressesApi`, `ArchiveSearchApi` and
 * `RegistrySummaryApi` in `@cadastre/api-contracts/registry` — and since
 * COMM-55, COMM-56 and COMM-58 there is an `/api` route over each, so the
 * screen speaks to this system's own origin and the register is not on the
 * browser's map at all.
 *
 * The lookup and the search sit side by side and are not one endpoint with a
 * flag, for the reason the contract keeps them apart: a lookup is asked on a
 * submission's behalf and resolves to the one record a verification stage may
 * act on; a search is asked by a person at the counter and offers everything
 * that might be it. Folding them together would make the lookup forgiving,
 * which is the one thing it must not be.
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
  ArchiveSearchResponseSchema,
  RegistrySummaryResponseSchema,
  type AddressLookupRequest,
  type AddressLookupResponse,
  type ArchiveSearchRequest,
  type ArchiveSearchResponse,
  type RegistrySummaryResponse,
} from '@cadastre/api-contracts/registry';

/**
 * The cache tag the register's own count of itself is held under.
 *
 * One tag and no id: there is a single summary, asked with no argument, and a
 * per-source tag would promise a granularity the register does not answer at —
 * it recounts the whole archive or nothing.
 */
const HOLDINGS_TAG = 'RegistrySummary' as const;

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
     * The archive searched by any of the three criteria an operator has —
     * a name, half a parcel number, an address written the way the applicant
     * wrote it — with a confidence per record and per criterion.
     *
     * A POST for the same reason the lookup is one, and the reason the summary
     * beside it is not: a name and an address are somebody's property, and the
     * summary carries nothing about anybody.
     *
     * The request is the cache key, threshold included, so moving the
     * threshold asks a new question rather than re-filtering an old answer —
     * which is what it has to be: the register decides what clears the bar and
     * counts `matched` and `considered` against it, and a client that filtered
     * its own cached rows would print figures the register never wrote.
     */
    searchArchive: build.query<ArchiveSearchResponse, ArchiveSearchRequest>({
      query: request => ({
        url: '/registry/search',
        method: 'POST',
        body: request,
      }),
      // Parsed and not cast, as the lookup is: the gateway hands the
      // register's answer through untouched.
      transformResponse: (response: unknown): ArchiveSearchResponse =>
        ArchiveSearchResponseSchema.parse(response),
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
      // The figures are cacheable and they do move, so they are tagged: an
      // import loads the archive from outside this base query entirely, and
      // `archiveHoldingsChanged` below is the only way it can say so.
      providesTags: [HOLDINGS_TAG],
    }),
  }),
});

export const {
  useArchiveSummaryQuery,
  useLookupAddressQuery,
  useSearchArchiveQuery,
} = archiveApi;

/**
 * The archive is not what it was — forget what was said about it.
 *
 * Dispatched by whoever loaded it. That is the workbook import, and it is a
 * bare axios call to the register's own origin rather than an endpoint on this
 * base query (ADR-0011 §1, TECH_DEBT §10), so it has no `invalidatesTags` of
 * its own to declare; this is what it uses instead. The band re-asks the moment
 * the register reports what it stored, rather than at the end of a poll the
 * operator has no reason to wait through.
 */
export const archiveHoldingsChanged = () =>
  api.util.invalidateTags([HOLDINGS_TAG]);
