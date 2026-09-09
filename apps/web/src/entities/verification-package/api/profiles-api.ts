/**
 * Verification Profiles — served live by `GET /api/profiles`.
 *
 * The register used to keep its own copy of which documents each profile
 * expects. It no longer does: a profile is policy the engine interprets, so the
 * engine is the one place that may say what it contains. Two copies of that
 * meant the screen could tally a package against documents the classifier was
 * never looking for.
 */
import { api } from '@/shared/api';
import {
  ListProfilesResponseSchema,
  ProfileSuggestionDtoSchema,
  type ListProfilesResponse,
  type ProfileSuggestionDto,
  type SuggestProfileRequestInput,
} from '@cadastre/api-contracts/verification';

export const profilesApi = api.injectEndpoints({
  endpoints: build => ({
    getProfiles: build.query<ListProfilesResponse, void>({
      query: () => '/profiles',
      // Policy changes with a deployment, not with a package, so there is
      // nothing here for a `Package` write to invalidate.
      transformResponse: (response: unknown) =>
        ListProfilesResponseSchema.parse(response),
    }),
    /*
     * Which profile the figures declared at intake point at, and why.
     *
     * A query and not a mutation because it is one: nothing is created, the
     * intake screen asks it while the operator is still typing, and asking it
     * changes nothing about the package that follows. The request is the cache
     * key, so a declaration asked about twice — typed, changed, typed back — is
     * one call.
     *
     * A recommendation, and the screen treats it as one: `POST /packages` is
     * sent the operator's own choice of profile whatever this answered, and
     * nothing here ever writes that choice.
     */
    suggestProfile: build.query<
      ProfileSuggestionDto,
      SuggestProfileRequestInput
    >({
      query: params => ({ url: '/profiles/suggestion', params }),
      // Parsed and not cast, like every other answer on this base query: a
      // suggestion that has drifted from the contract must fail here, named,
      // rather than draw as an empty reason beside a field.
      transformResponse: (response: unknown) =>
        ProfileSuggestionDtoSchema.parse(response),
    }),
  }),
});

export const { useGetProfilesQuery, useSuggestProfileQuery } = profilesApi;
