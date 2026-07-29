/**
 * Verification-package API — live endpoints over the core service, injected
 * into the shared RTK Query base. The register reads package summaries here and
 * creates new packages from already-uploaded documents (step 1 of the flow).
 *
 * Each endpoint names the contract's *response* type for its own URL rather than
 * a shared DTO, and parses the body through that endpoint's schema. Zod ships
 * alongside the types in `@cadastre/contracts`, so declining to run it would
 * leave the one place the two sides can actually drift — the wire — checked only
 * by a compiler that never sees the server. A mismatch then surfaces here, named,
 * instead of as an `undefined` three components away.
 */
import {
  GetPackageResponseSchema,
  ListPackagesResponseSchema,
  type CreatePackageRequest,
  type CreatePackageResponse,
  type GetPackageResponse,
} from "@cadastre/contracts"

import { api } from "@/shared/api"

import {
  toViewPackage,
  type VerificationPackage,
} from "../model/verification-package"

export const packagesApi = api.injectEndpoints({
  endpoints: (build) => ({
    getPackages: build.query<VerificationPackage[], void>({
      query: () => "/packages",
      transformResponse: (response: unknown) =>
        ListPackagesResponseSchema.parse(response).map(toViewPackage),
      providesTags: ["Package"],
    }),
    getPackage: build.query<GetPackageResponse, string>({
      query: (id) => `/packages/${id}`,
      transformResponse: (response: unknown) =>
        GetPackageResponseSchema.parse(response),
      providesTags: (_result, _error, id) => [{ type: "Package", id }],
    }),
    createPackage: build.mutation<CreatePackageResponse, CreatePackageRequest>({
      query: (body) => ({ url: "/packages", method: "POST", body }),
      invalidatesTags: ["Package"],
    }),
  }),
})

export const {
  useGetPackagesQuery,
  useGetPackageQuery,
  useCreatePackageMutation,
} = packagesApi
