/**
 * The archive register, as the browser reaches it.
 *
 * `apps/web` normally speaks `@cadastre/api-contracts` through
 * `libs/api-gateway` and nothing else. The lookup **is** in the contract —
 * `AddressesApi` in `@cadastre/api-contracts/registry` — but the gateway
 * publishes the verification area only, so there is no `/api` route that
 * reaches it. Until there is, this calls the register at the origin the dev
 * server and `nginx.conf` proxy to, the same crossing the workbook import
 * already makes (TECH_DEBT §10, and the paragraph added there for this screen).
 *
 * What it does **not** do is restate the shapes: request and response are the
 * contract's own, parsed through the contract's own Zod schema, so the one
 * place the two sides can drift — the wire — is checked rather than assumed.
 *
 * A POST and not a GET, because the register makes it one: the address is
 * somebody's property and has no business in a URL, a query string or an access
 * log.
 */
import axios from 'axios';

import { api } from '@/shared/api';
import { registryBase } from '@/shared/config';
import {
  AddressLookupResponseSchema,
  type AddressLookupRequest,
  type AddressLookupResponse,
} from '@cadastre/api-contracts/registry';

/** The register's routes, under its own `api` global prefix. */
const LOOKUP_PATH = '/api/addresses/lookup';
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
     * `queryFn` rather than `query`, because the shared base query is bound to
     * `/api` — the core service's origin — and this request goes to a different
     * system. Everything else about it is an ordinary endpoint: the request is
     * the cache key, so a lookup already made comes back without a call.
     */
    lookupAddress: build.query<AddressLookupResponse, AddressLookupRequest>({
      queryFn: async request => {
        try {
          const { data } = await axios.post<unknown>(
            `${registryBase}${LOOKUP_PATH}`,
            request,
          );
          return { data: AddressLookupResponseSchema.parse(data) };
        } catch (error) {
          return { error: { status: 'CUSTOM_ERROR', error: String(error) } };
        }
      },
    }),
    /*
     * The register's liveness, which is all it publishes about itself: it
     * answers `{ status: 'ok' }` and says nothing about how many workbooks it
     * loaded or how many records they hold. The sidebar states what it can
     * therefore know — that the archive is answering — and no number.
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
