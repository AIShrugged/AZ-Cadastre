/**
 * Verification-package API — live endpoints over the core service, injected
 * into the shared RTK Query base. The register reads package summaries here and
 * creates new packages from already-uploaded documents (step 1 of the flow).
 */
import type {
  CreatePackageRequest,
  PackageDetailDto,
  PackageDto,
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
      transformResponse: (dtos: PackageDto[]) => dtos.map(toViewPackage),
      providesTags: ["Package"],
    }),
    getPackage: build.query<PackageDetailDto, string>({
      query: (id) => `/packages/${id}`,
      providesTags: (_result, _error, id) => [{ type: "Package", id }],
    }),
    createPackage: build.mutation<PackageDto, CreatePackageRequest>({
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
