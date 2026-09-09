/**
 * The archive register, as the browser reaches it.
 *
 * The lookup goes through the gateway like everything else: it **is** in the
 * contract — `AddressesApi` in `@cadastre/api-contracts/registry` — and since
 * COMM-55 there is an `/api` route over it, so the screen speaks to this
 * system's own origin and the register is not on the browser's map at all.
 *
 * What it does **not** do is restate the shapes: request and response are the
 * contract's own, and the answer is parsed through the contract's own Zod
 * schema, so the one place the two sides can drift — the wire — is checked
 * rather than assumed.
 *
 * The liveness probe below is the exception, and the one crossing left on this
 * screen. It is not in the contract and must not be: whether a stand-in process
 * is up is a fact about this deployment, not something a real state register
 * would have to publish. It keeps the `/registry` proxy alive alongside the
 * workbook import (TECH_DEBT §10).
 */
import axios from 'axios';

import { api } from '@/shared/api';
import { registryBase } from '@/shared/config';
import {
  AddressLookupResponseSchema,
  type AddressLookupRequest,
  type AddressLookupResponse,
} from '@cadastre/api-contracts/registry';

/** The register's own liveness route, under its own `api` global prefix. */
const HEALTH_PATH = '/api/health';

/**
 * Whether the register is answering at all.
 *
 * Three states and not two: a register that has not been asked yet is not a
 * register that is down, and a sidebar that reads "unreachable" for the half
 * second before the first answer would be lying twice a page.
 */
export type ArchiveReach = 'answering' | 'silent';

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
     * The register's liveness, which is all it publishes about itself: it
     * answers `{ status: 'ok' }` and says nothing about how many workbooks it
     * loaded or how many records they hold. The sidebar states what it can
     * therefore know — that the archive is answering — and no number.
     *
     * `queryFn` rather than `query`, because the shared base query is bound to
     * `/api` — this system's origin — and this one request still goes straight
     * to the register.
     */
    archiveReach: build.query<ArchiveReach, void>({
      queryFn: async () => {
        try {
          await axios.get(`${registryBase}${HEALTH_PATH}`);
          return { data: 'answering' as const };
        } catch {
          return { data: 'silent' as const };
        }
      },
    }),
  }),
});

export const { useLookupAddressQuery, useArchiveReachQuery } = archiveApi;
