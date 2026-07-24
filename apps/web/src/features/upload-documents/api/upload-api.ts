import axios from "axios"
import type {
  DocumentContentType,
  PresignResponse,
} from "@cadastre/contracts"

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

const CONTENT_TYPE: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
}

function contentTypeFor(file: File): string {
  if (file.type) return file.type
  const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
  return CONTENT_TYPE[ext] ?? "application/octet-stream"
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
    { filename: file.name, contentType },
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
