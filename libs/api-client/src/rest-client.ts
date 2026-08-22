import { z } from 'zod';

import {
  ErrorBodySchema,
  type ErrorBody,
} from '@cadastre/api-contracts/shared';
import {
  CreatePackageRequestSchema,
  PackageDetailDtoSchema,
  PackageDtoSchema,
  PresignRequestSchema,
  PresignResponseSchema,
  ProfileDtoSchema,
  type CreatePackageRequest,
  type PackageDetailDto,
  type PackageDto,
  type PresignRequest,
  type PresignResponse,
  type ProfileDto,
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

  // --- profiles -----------------------------------------------------------

  profiles = {
    findMany: (): Promise<ApiResponse<ProfileDto[]>> =>
      this.request('GET', '/api/profiles', z.array(ProfileDtoSchema)),
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

    findMany: (): Promise<ApiResponse<PackageDto[]>> =>
      this.request('GET', '/api/packages', z.array(PackageDtoSchema)),

    findOne: (id: string): Promise<ApiResponse<PackageDetailDto>> =>
      this.request(
        'GET',
        `/api/packages/${encodeURIComponent(id)}`,
        PackageDetailDtoSchema,
      ),
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
