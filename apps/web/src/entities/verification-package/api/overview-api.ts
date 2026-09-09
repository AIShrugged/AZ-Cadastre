/**
 * The summary of a period — one call for all four slices, because the endpoint
 * is one call for all four.
 *
 * Asked separately, the numbers on the screen would be from four different
 * moments and would not add up: a run finishing between two calls is counted as
 * under way by one and as reported on by the next. The server reads them in a
 * single transaction so every number describes the same instant (ADR-0017), and
 * splitting them into four queries here would throw that away on the client
 * side of the wire.
 */
import { api } from '@/shared/api';
import {
  PackagesOverviewResponseSchema,
  type PackagesOverviewRequestInput,
  type PackagesOverviewResponse,
} from '@cadastre/api-contracts/verification';

export const overviewApi = api.injectEndpoints({
  endpoints: build => ({
    /*
     * The request is the cache key, so each period keeps its own answer and a
     * window already looked at comes back without a call. `fetchBaseQuery`
     * drops the undefined members, so the whole register — which names no bound
     * — is the bare URL the endpoint reads as "everything ever taken in".
     *
     * Tagged `Package`, so the summary is re-asked whenever a submission is
     * created, has files added, or is signed off: every one of those changes a
     * number on this screen, and a summary that kept saying what was true
     * before the write is worse than one that is briefly blank.
     */
    getPackagesOverview: build.query<
      PackagesOverviewResponse,
      PackagesOverviewRequestInput
    >({
      query: params => ({ url: '/packages/overview', params }),
      transformResponse: (response: unknown) =>
        PackagesOverviewResponseSchema.parse(response),
      providesTags: ['Package'],
    }),
  }),
});

export const { useGetPackagesOverviewQuery } = overviewApi;
