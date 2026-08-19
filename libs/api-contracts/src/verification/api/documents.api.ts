import type { PresignRequest, PresignResponse } from "../dto/index.js";

export interface DocumentsApi {
  presign(request: PresignRequest): Promise<PresignResponse>;
}
