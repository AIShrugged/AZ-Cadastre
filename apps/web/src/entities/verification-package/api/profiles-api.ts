/**
 * Verification Profiles — served live by `GET /api/profiles`.
 *
 * The register used to keep its own copy of which documents each profile
 * expects. It no longer does: a profile is policy the engine interprets, so the
 * engine is the one place that may say what it contains. Two copies of that
 * meant the screen could tally a package against documents the classifier was
 * never looking for.
 */
import {
  ListProfilesResponseSchema,
  type ListProfilesResponse,
} from "@cadastre/api-contracts/verification"

import { api } from "@/shared/api"

export const profilesApi = api.injectEndpoints({
  endpoints: (build) => ({
    getProfiles: build.query<ListProfilesResponse, void>({
      query: () => "/profiles",
      // Policy changes with a deployment, not with a package, so there is
      // nothing here for a `Package` write to invalidate.
      transformResponse: (response: unknown) =>
        ListProfilesResponseSchema.parse(response),
    }),
  }),
})

export const { useGetProfilesQuery } = profilesApi
