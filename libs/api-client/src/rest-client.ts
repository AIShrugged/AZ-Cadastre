import { z } from 'zod';

import {
  AddressLookupRequestSchema,
  AddressLookupResponseSchema,
  ArchiveSearchRequestSchema,
  ArchiveSearchResponseSchema,
  RegistrySummaryResponseSchema,
  type AddressLookupRequest,
  type AddressLookupResponse,
  type ArchiveSearchRequestInput,
  type ArchiveSearchResponse,
  type RegistrySummaryResponse,
} from '@cadastre/api-contracts/registry';
import {
  ErrorBodySchema,
  type ErrorBody,
} from '@cadastre/api-contracts/shared';
import {
  AddFilesRequestSchema,
  ApproveArchiveSearchRequestSchema,
  CreatePackageRequestSchema,
  ListPackagesRequestSchema,
  ListPackagesResponseSchema,
  PackageDetailDtoSchema,
  PackageDtoSchema,
  PackagesOverviewRequestSchema,
  PackagesOverviewResponseSchema,
  PresignRequestSchema,
  PresignResponseSchema,
  ProfileDtoSchema,
  ProfileSuggestionDtoSchema,
  SuggestProfileRequestSchema,
  SupplyDocumentRequestSchema,
  type AddFilesRequest,
  type ApproveArchiveSearchRequest,
  type CreatePackageRequest,
  type ListPackagesRequestInput,
  type ListPackagesResponse,
  type PackageDetailDto,
  type PackageDto,
  type PackagesOverviewRequestInput,
  type PackagesOverviewResponse,
  type PresignRequest,
  type PresignResponse,
  type ProfileDto,
  type ProfileSuggestionDto,
  type SuggestProfileRequestInput,
  type SupplyDocumentRequest,
} from '@cadastre/api-contracts/verification';

/**
 * One HTTP answer, kept whole. A test that asserts on a status code needs the
 * status; one that asserts on a body needs the body parsed by the contract's
 * own schema — which is the point of this client. A response the schema rejects
 * is a broken API, and saying so here means every spec gets the check for free.
 */
export type ApiResponse<T> = {
  readonly status: number;
  readonly body: T;
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: ErrorBody,
  ) {
    super(`${body.code}: ${body.message}`);
    this.name = 'ApiError';
  }
}

/**
 * The published API as a caller sees it: one method per operation, named after
 * the contract's own operation, and typed by the contract's own DTOs. It knows
 * no domain term the contracts do not publish, which is what keeps it honest
 * about being a client rather than a second implementation.
 */
export class RestClient {
  constructor(private readonly baseUrl: string) {}

  // --- addresses ----------------------------------------------------------

  /**
   * The archive register's area of the API. The register is a system outside
   * this one and the route is a door onto it (ADR-0009), so what a caller sees
   * here is the register's own published shapes and no wrapper of ours.
   */
  addresses = {
    lookup: (
      request: AddressLookupRequest,
    ): Promise<ApiResponse<AddressLookupResponse>> =>
      this.request(
        'POST',
        '/api/addresses/lookup',
        AddressLookupResponseSchema,
        AddressLookupRequestSchema.parse(request),
      ),

    /** Deliberately unvalidated, for the specs that check the API's own refusals. */
    lookupRaw: (body: unknown): Promise<ApiResponse<unknown>> =>
      this.request('POST', '/api/addresses/lookup', z.unknown(), body),
  };

  // --- registry -----------------------------------------------------------

  /**
   * The register asked about itself rather than about a property: how many of
   * the archive's sources are in and how many records they hold. A GET, because
   * there is nothing about anybody in the request.
   */
  registry = {
    summary: (): Promise<ApiResponse<RegistrySummaryResponse>> =>
      this.request(
        'GET',
        '/api/registry/summary',
        RegistrySummaryResponseSchema,
      ),

    /**
     * The archive searched by any of the things a property is known by, rather
     * than resolved by the one the lookup takes. A POST, because what is
     * searched for is somebody's name and somebody's property.
     *
     * The input type and not the parsed one: a caller names the criteria it
     * has and leaves the threshold and the page size to the defaults the
     * contract publishes, rather than restating them here.
     */
    search: (
      request: ArchiveSearchRequestInput,
    ): Promise<ApiResponse<ArchiveSearchResponse>> =>
      this.request(
        'POST',
        '/api/registry/search',
        ArchiveSearchResponseSchema,
        ArchiveSearchRequestSchema.parse(request),
      ),

    /** Deliberately unvalidated, for the specs that check the API's own refusals. */
    searchRaw: (body: unknown): Promise<ApiResponse<unknown>> =>
      this.request('POST', '/api/registry/search', z.unknown(), body),
  };

  // --- profiles -----------------------------------------------------------

  profiles = {
    findMany: (): Promise<ApiResponse<ProfileDto[]>> =>
      this.request('GET', '/api/profiles', z.array(ProfileDtoSchema)),

    /**
     * Which profile the figures declared at intake point at, and why. A
     * recommendation: what a package is filed under is whatever the operator
     * sends to `POST /packages`, and this never narrows it.
     *
     * Naming neither figure is a question in its own right — "the operator has
     * typed nothing yet" — and the server answers it with no profile and the
     * reason, which is what an empty query string asks for here.
     */
    suggest: (
      declared: SuggestProfileRequestInput = {},
    ): Promise<ApiResponse<ProfileSuggestionDto>> =>
      this.request(
        'GET',
        `/api/profiles/suggestion${declarationQuery(declared)}`,
        ProfileSuggestionDtoSchema,
      ),

    /** Deliberately unparsed, for the specs that check the API's own refusals. */
    suggestRaw: (query: string): Promise<ApiResponse<unknown>> =>
      this.request('GET', `/api/profiles/suggestion${query}`, z.unknown()),
  };

  // --- documents ----------------------------------------------------------

  documents = {
    presign: (request: PresignRequest): Promise<ApiResponse<PresignResponse>> =>
      this.request(
        'POST',
        '/api/documents/presign',
        PresignResponseSchema,
        PresignRequestSchema.parse(request),
      ),

    /** Deliberately unvalidated, for the specs that check the API's own refusals. */
    presignRaw: (body: unknown): Promise<ApiResponse<unknown>> =>
      this.request('POST', '/api/documents/presign', z.unknown(), body),
  };

  // --- packages -----------------------------------------------------------

  packages = {
    create: (request: CreatePackageRequest): Promise<ApiResponse<PackageDto>> =>
      this.request(
        'POST',
        '/api/packages',
        PackageDtoSchema,
        CreatePackageRequestSchema.parse(request),
      ),

    createRaw: (body: unknown): Promise<ApiResponse<unknown>> =>
      this.request('POST', '/api/packages', z.unknown(), body),

    addFiles: (
      id: string,
      request: AddFilesRequest,
    ): Promise<ApiResponse<PackageDto>> =>
      this.request(
        'POST',
        `/api/packages/${encodeURIComponent(id)}/files`,
        PackageDtoSchema,
        AddFilesRequestSchema.parse(request),
      ),

    addFilesRaw: (id: string, body: unknown): Promise<ApiResponse<unknown>> =>
      this.request(
        'POST',
        `/api/packages/${encodeURIComponent(id)}/files`,
        z.unknown(),
        body,
      ),

    /**
     * One document, sent in for one of the gaps `findOne` publishes (COMM-80).
     * A different call from `addFiles` because this file answers something: it
     * names the paper it is meant to be, and where it replaces a scan the run
     * read badly, the document it stands in for.
     */
    supplyDocument: (
      id: string,
      request: SupplyDocumentRequest,
    ): Promise<ApiResponse<PackageDto>> =>
      this.request(
        'POST',
        `/api/packages/${encodeURIComponent(id)}/documents`,
        PackageDtoSchema,
        SupplyDocumentRequestSchema.parse(request),
      ),

    /** Deliberately unvalidated, for the specs that check the API's own refusals. */
    supplyDocumentRaw: (
      id: string,
      body: unknown,
    ): Promise<ApiResponse<unknown>> =>
      this.request(
        'POST',
        `/api/packages/${encodeURIComponent(id)}/documents`,
        z.unknown(),
        body,
      ),

    /**
     * One page of the list. What is not named is left to the server's own
     * defaults — the newest twenty — rather than guessed at here, so the
     * client cannot drift from what the contract promises.
     */
    findMany: (
      request: ListPackagesRequestInput = {},
    ): Promise<ApiResponse<ListPackagesResponse>> =>
      this.request(
        'GET',
        `/api/packages${queryString(request)}`,
        ListPackagesResponseSchema,
      ),

    /** Deliberately unparsed, for the specs that check the API's own refusals. */
    findManyRaw: (query: string): Promise<ApiResponse<unknown>> =>
      this.request('GET', `/api/packages${query}`, z.unknown()),

    /**
     * A person's approval of what the archive register answered. It carries no
     * author because the system has none to record (ADR-0016), and it comes
     * back as the whole package so the standing it changes is visible at once.
     */
    approveArchiveSearch: (
      id: string,
      request: ApproveArchiveSearchRequest,
    ): Promise<ApiResponse<PackageDetailDto>> =>
      this.request(
        'POST',
        `/api/packages/${encodeURIComponent(id)}/archive-search-approval`,
        PackageDetailDtoSchema,
        ApproveArchiveSearchRequestSchema.parse(request),
      ),

    /** Deliberately unvalidated, for the specs that check the API's own refusals. */
    approveArchiveSearchRaw: (
      id: string,
      body: unknown,
    ): Promise<ApiResponse<unknown>> =>
      this.request(
        'POST',
        `/api/packages/${encodeURIComponent(id)}/archive-search-approval`,
        z.unknown(),
        body,
      ),

    findOne: (id: string): Promise<ApiResponse<PackageDetailDto>> =>
      this.request(
        'GET',
        `/api/packages/${encodeURIComponent(id)}`,
        PackageDetailDtoSchema,
      ),

    /**
     * The four tallies of a period. Naming no bound asks about every
     * submission the office has ever taken in, which is what the server does
     * with an empty query string.
     */
    overview: (
      period: PackagesOverviewRequestInput = {},
    ): Promise<ApiResponse<PackagesOverviewResponse>> =>
      this.request(
        'GET',
        `/api/packages/overview${periodQuery(period)}`,
        PackagesOverviewResponseSchema,
      ),

    /** Deliberately unparsed, for the specs that check the API's own refusals. */
    overviewRaw: (query: string): Promise<ApiResponse<unknown>> =>
      this.request('GET', `/api/packages/overview${query}`, z.unknown()),
  };

  // ------------------------------------------------------------------------

  /**
   * Throws `ApiError` on any non-2xx, so a spec asserting a refusal says so
   * explicitly (`rejects`) instead of forgetting to look at the status.
   */
  private async request<T>(
    method: string,
    path: string,
    schema: z.ZodType<T>,
    body?: unknown,
  ): Promise<ApiResponse<T>> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const text = await response.text();
    const payload: unknown = text === '' ? undefined : JSON.parse(text);

    if (!response.ok) {
      throw new ApiError(response.status, ErrorBodySchema.parse(payload));
    }

    return { status: response.status, body: schema.parse(payload) };
  }
}

/**
 * The request as a query string, parsed by the contract's own schema first so a
 * client cannot send what the server would refuse. Absent values are left out
 * entirely: `?standing=` is a standing nobody names, not an unset filter.
 */
function periodQuery(period: PackagesOverviewRequestInput): string {
  const parsed = PackagesOverviewRequestSchema.parse(period);
  const params = new URLSearchParams();

  if (parsed.from !== undefined) params.set('from', parsed.from);
  if (parsed.to !== undefined) params.set('to', parsed.to);

  // A bare path rather than a lone `?`: a period nobody named is no query
  // string at all, which is what the server's own default answers.
  const query = params.toString();

  return query === '' ? '' : `?${query}`;
}

function declarationQuery(declared: SuggestProfileRequestInput): string {
  const parsed = SuggestProfileRequestSchema.parse(declared);
  const params = new URLSearchParams();

  if (parsed.legalBasis !== undefined) {
    params.set('legalBasis', parsed.legalBasis);
  }
  if (parsed.builtYear !== undefined) {
    params.set('builtYear', String(parsed.builtYear));
  }

  const query = params.toString();

  return query === '' ? '' : `?${query}`;
}

function queryString(request: ListPackagesRequestInput): string {
  const parsed = ListPackagesRequestSchema.parse(request);
  const params = new URLSearchParams();

  if (parsed.search !== undefined) params.set('search', parsed.search);
  // One `standing` per value asked for, which is how a repeatable query
  // parameter travels: `set` would keep only the last and quietly narrow a
  // slice of two to a slice of one.
  for (const standing of parsed.standing ?? []) {
    params.append('standing', standing);
  }
  if (parsed.reportStatus !== undefined) {
    params.set('reportStatus', parsed.reportStatus);
  }
  params.set('limit', String(parsed.limit));
  params.set('offset', String(parsed.offset));

  return `?${params.toString()}`;
}
