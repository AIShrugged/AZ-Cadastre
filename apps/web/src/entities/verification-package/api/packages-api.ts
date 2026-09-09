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
  type ListPackagesRequestInput,
} from '@cadastre/api-contracts/verification';

import {
  toViewPackage,
  type VerificationPackage,
} from '../model/verification-package';

/**
 * One page of the register, and how many rows the question matched in total.
 *
 * `limit` and `offset` are kept as the answer echoed them rather than as the
 * screen remembers asking: an answer that arrives after the reader has moved on
 * says which page it is, so it cannot be drawn as the page they are looking at.
 */
export type PackagePage = {
  items: VerificationPackage[];
  total: number;
  limit: number;
  offset: number;
};

export const packagesApi = api.injectEndpoints({
  endpoints: build => ({
    /*
     * One page of the submissions, narrowed by what the register was asked for.
     * Never the whole list: the endpoint searches, filters and pages over every
     * submission the office has taken in (ADR-0015), and the two filters go on
     * the wire as two parameters because they answer two questions — where a
     * submission stands, and what the run found.
     *
     * The request is the cache key, so each question keeps its own answer and
     * a page already read comes back without a call. `fetchBaseQuery` drops the
     * undefined members, so a filter nobody set is a parameter nobody sends.
     */
    getPackages: build.query<PackagePage, ListPackagesRequestInput>({
      query: params => ({ url: '/packages', params }),
      transformResponse: (response: unknown): PackagePage => {
        const page = ListPackagesResponseSchema.parse(response);
        return {
          items: page.items.map(toViewPackage),
          total: page.total,
          limit: page.limit,
          offset: page.offset,
        };
      },
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
