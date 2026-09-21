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
import type { ThunkDispatch, UnknownAction } from '@reduxjs/toolkit';
import { useDispatch } from 'react-redux';

import { api } from '@/shared/api';
import {
  AddFilesResponseSchema,
  ApproveArchiveSearchResponseSchema,
  EditDocumentFieldsResponseSchema,
  GetPackageResponseSchema,
  ListPackagesResponseSchema,
  SupplyDocumentResponseSchema,
  type AddFilesRequest,
  type AddFilesResponse,
  type ApproveArchiveSearchRequest,
  type ApproveArchiveSearchResponse,
  type CreatePackageRequest,
  type CreatePackageResponse,
  type EditDocumentFieldsRequest,
  type EditDocumentFieldsResponse,
  type GetPackageResponse,
  type ListPackagesRequestInput,
  type SupplyDocumentRequest,
  type SupplyDocumentResponse,
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
     * One file, sent in for one of the gaps the package publishes (COMM-80).
     *
     * The difference from `addFiles` is the target, and it is the whole
     * difference: this file says which paper it is meant to be and, where it
     * replaces a scan the run read badly, which document it stands in for — so
     * the package can afterwards say whether what arrived closed the gap it was
     * sent for. Both values are copied off a published gap and never assembled
     * here; a target that is not on the list is refused with
     * `NO_SUCH_DOCUMENT_GAP`.
     *
     * Same road for the bytes as every other file — `documents/presign` signs
     * the URL, the browser PUTs, and this is handed the key — and the same two
     * tags as `addFiles`, because the package re-opens and is verified afresh
     * (ADR-0013): the detail this screen is reading and the row the register
     * draws for it are both stale the moment the call returns.
     */
    supplyDocument: build.mutation<
      SupplyDocumentResponse,
      { id: string; body: SupplyDocumentRequest }
    >({
      query: ({ id, body }) => ({
        url: `/packages/${id}/documents`,
        method: 'POST',
        body,
      }),
      transformResponse: (response: unknown) =>
        SupplyDocumentResponseSchema.parse(response),
      invalidatesTags: (_result, _error, { id }) => [
        'Package',
        { type: 'Package', id },
      ],
    }),
    /*
     * What an operator read off the paper where the engine read it wrong, or
     * did not read it at all (ADR-0033).
     *
     * One call per document and never per field: the body carries every
     * correction made to one paper, because the save re-opens the package and
     * verifies it afresh — a call per keystroke would be one run per keystroke,
     * each of them reading a form still being filled in.
     *
     * It answers with the package as it now stands, so the screen the
     * correction was made on re-renders off the answer instead of asking again.
     * Only the bare tag is named here: the detail the caller is looking at is
     * written straight into the cache by the caller, and naming `{ Package, id }`
     * as well would send this screen round a refetch it has already been given
     * the answer to. The register's rows are another matter — the package is
     * back in the queue and its row says something else now.
     */
    editDocumentFields: build.mutation<
      EditDocumentFieldsResponse,
      { id: string; documentId: string; body: EditDocumentFieldsRequest }
    >({
      query: ({ id, documentId, body }) => ({
        url: `/packages/${id}/documents/${documentId}/fields`,
        method: 'POST',
        body,
      }),
      transformResponse: (response: unknown) =>
        EditDocumentFieldsResponseSchema.parse(response),
      invalidatesTags: ['Package'],
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
  useEditDocumentFieldsMutation,
  useSupplyDocumentMutation,
  useApproveArchiveSearchMutation,
} = packagesApi;

/**
 * A dispatch that will take RTK Query's own cache thunks.
 *
 * `AppDispatch` (`shared/lib/store-hooks`) is deliberately state-agnostic so
 * that entities and features need not import the app's store type, and it
 * promises `unknown` state. The cache writes are the one thing that does not
 * fit: they read the api slice back out of the store, so their type names the
 * state they need, and `unknown` is not it. `never` is — a dispatch that
 * asserts nothing about the store rather than asserting the wrong thing, and
 * one that accepts a thunk over any state without an `any` anywhere. The store
 * it is actually handed is the app's, which holds the slice.
 */
type CacheDispatch = ThunkDispatch<never, unknown, UnknownAction>;

/**
 * Putting a package the server has just answered with where the detail screen
 * is already reading it.
 *
 * Every write on a package answers with the whole package, which exists so that
 * the screen that made the write re-renders off the answer instead of asking
 * again for what it has just been told. Without this the screen would show the
 * pre-write package until a refetch came back — and on a correction that means
 * showing a settled case with a report for as long as the round trip takes,
 * when the case has in fact re-opened.
 */
export function useKeepPackage(): (pkg: GetPackageResponse) => void {
  const dispatch = useDispatch<CacheDispatch>();

  return pkg => {
    dispatch(packagesApi.util.upsertQueryData('getPackage', pkg.id, pkg));
  };
}
