import axios from "axios"
import type {
  DocumentContentType,
  PresignResponse,
} from "@cadastre/api-contracts/verification"

import { http } from "@/shared/api"

/** What the transport resolves with once a document is stored. */
export type UploadResult = {
  /** Object key the file now lives under in the bucket. */
  key: string
  /** MIME type the file was stored as (pinned into the presign signature). */
  contentType: DocumentContentType
}

export type UploadHandlers = {
  /** Transfer progress, 0–100. */
  onProgress?: (progress: number) => void
  signal?: AbortSignal
}

/** The extensions this feature accepts, mapped to the formats the engine does. */
const CONTENT_TYPE: Record<string, DocumentContentType> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
}

/**
 * The extension decides, and `file.type` is only a fallback — the other way
 * round from what this used to do.
 *
 * Which formats the system accepts is a rule `ContentType` owns, and the set it
 * accepts is the one keyed here. A browser is free to label a `.jpg` as
 * `image/jpg` or a `.pdf` as `application/x-pdf`, and passing that along got the
 * presign refused for a file this feature had already validated — the inspector
 * saw "Upload failed" for a document that was perfectly fine.
 */
function contentTypeFor(file: File): string {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
  return CONTENT_TYPE[ext] ?? file.type
}

/**
 * Upload one document straight to object storage:
 *   1. ask core for a presigned PUT URL
 *   2. PUT the bytes there directly (progress + cancellation via axios)
 * The file never passes through the core service.
 */
export async function uploadDocument(
  file: File,
  { onProgress, signal }: UploadHandlers = {},
): Promise<UploadResult> {
  const contentType = contentTypeFor(file)

  const { data } = await http.post<PresignResponse>(
    "/documents/presign",
    { filename: file.name, contentType, size: file.size },
    { signal },
  )

  await axios.put(data.url, file, {
    signal,
    headers: { "Content-Type": data.contentType },
    onUploadProgress: (e) => {
      const total = e.total ?? file.size
      if (total > 0) onProgress?.(Math.round((e.loaded / total) * 100))
    },
  })

  return { key: data.key, contentType: data.contentType }
}
