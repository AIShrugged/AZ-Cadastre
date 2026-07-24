import type { DocumentContentType } from "@cadastre/contracts"

export type FileKind = "pdf" | "image"
export type UploadStatus = "uploading" | "ready" | "error"
export type UploadErrorKind = "format" | "size" | "failed"

/**
 * One submitted document as tracked by the store. We keep only the metadata the
 * UI renders — never the raw `File` (non-serializable). The bytes live with the
 * upload transport (`api/upload-api`), keyed by `id`.
 */
export type Attachment = {
  id: string
  name: string
  size: number
  kind: FileKind
  status: UploadStatus
  progress: number
  /** Object key in the bucket once the transfer completes. */
  key?: string
  /** MIME type the file was stored as — sent when creating the package. */
  contentType?: DocumentContentType
  /** Resolved later by the pipeline once a PDF is read. */
  pages?: number
  error?: UploadErrorKind
}
