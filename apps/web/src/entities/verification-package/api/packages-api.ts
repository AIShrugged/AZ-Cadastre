/**
 * Verification-package API — live endpoints over the core service, injected
 * into the shared RTK Query base. The register reads package summaries here and
 * creates new packages from already-uploaded documents (step 1 of the flow).
 *
 * Each endpoint names the contract's *response* type for its own URL rather than
 * a shared DTO, and parses the body through that endpoint's schema. Zod ships
 * alongside the types in `@cadastre/api-contracts`, so declining to run it would
 * leave the one place the two sides can actually drift — the wire — checked only
 * by a compiler that never sees the server. A mismatch then surfaces here, named,
 * instead of as an `undefined` three components away.
 */
import { api } from '@/shared/api';
import {
  AddFilesResponseSchema,
  ApproveArchiveSearchResponseSchema,
  GetPackageResponseSchema,
  ListPackagesResponseSchema,
  type AddFilesRequest,
  type AddFilesResponse,
  type ApproveArchiveSearchRequest,
  type ApproveArchiveSearchResponse,
  type CreatePackageRequest,
  type CreatePackageResponse,
  type GetPackageResponse,
} from '@cadastre/api-contracts/verification';

import {
  toViewPackage,
  type VerificationPackage,
} from '../model/verification-package';

export const packagesApi = api.injectEndpoints({
  endpoints: build => ({
    /*
     * The newest page, on the server's own defaults: the endpoint pages,
     * searches and filters (ADR-0015), and the screen that puts a search box
     * and a pager over it is still to be built — until it is, asking for
     * nothing is asking for the first page.
     */
    getPackages: build.query<VerificationPackage[], void>({
      query: () => '/packages',
      transformResponse: (response: unknown) =>
        ListPackagesResponseSchema.parse(response).items.map(toViewPackage),
      providesTags: ['Package'],
    }),
    getPackage: build.query<GetPackageResponse, string>({
      query: id => `/packages/${id}`,
      transformResponse: (response: unknown) =>
        GetPackageResponseSchema.parse(response),
      providesTags: (_result, _error, id) => [{ type: 'Package', id }],
    }),
    createPackage: build.mutation<CreatePackageResponse, CreatePackageRequest>({
      query: body => ({ url: '/packages', method: 'POST', body }),
      invalidatesTags: ['Package'],
    }),
    /*
     * Files that arrived after the package did. They travel the road the files
     * a package is created with travel — `documents/presign` signs the URL, the
     * browser PUTs the bytes, and this is handed the keys; there is one way to
     * put a file in the store and this is not a second one.
     *
     * Both tags are named on purpose. The package this adds to is re-opened and
     * verified afresh (ADR-0013), so the detail this screen is reading is stale
     * the moment the call returns — and so is the row the register draws for
     * it, which providesTags with the bare tag.
     */
    addFiles: build.mutation<
      AddFilesResponse,
      { id: string; body: AddFilesRequest }
    >({
      query: ({ id, body }) => ({
        url: `/packages/${id}/files`,
        method: 'POST',
        body,
      }),
      transformResponse: (response: unknown) =>
        AddFilesResponseSchema.parse(response),
      invalidatesTags: (_result, _error, { id }) => [
        'Package',
        { type: 'Package', id },
      ],
    }),
    /*
     * The one write on this resource a person makes rather than the engine:
     * their sign-off on what the archive register answered about the
     * submission, and the conclusion they drew from it (ADR-0016).
     *
     * It answers with the package as it now stands, so the screen that has just
     * signed does not have to ask again — and both tags are named because the
     * standing is worked out from whether an approval is in force, which makes
     * the register row stale too.
     */
    approveArchiveSearch: build.mutation<
      ApproveArchiveSearchResponse,
      { id: string; body: ApproveArchiveSearchRequest }
    >({
      query: ({ id, body }) => ({
        url: `/packages/${id}/archive-search-approval`,
        method: 'POST',
        body,
      }),
      transformResponse: (response: unknown) =>
        ApproveArchiveSearchResponseSchema.parse(response),
      invalidatesTags: (_result, _error, { id }) => [
        'Package',
        { type: 'Package', id },
      ],
    }),
  }),
});

export const {
  useGetPackagesQuery,
  useGetPackageQuery,
  useCreatePackageMutation,
  useAddFilesMutation,
  useApproveArchiveSearchMutation,
} = packagesApi;
