export type PresignUploadInput = {
  /** Original filename, used to derive a stable object key. */
  filename: string;
  /** MIME type the browser will send; it is pinned into the signature. */
  contentType: string;
};

export type PresignedUpload = {
  /** Object key the file will live under in the bucket. */
  key: string;
  /** URL the browser PUTs the bytes to. */
  url: string;
  /** Content-Type the browser MUST send on the PUT to match the signature. */
  contentType: string;
  /** Seconds until the URL expires. */
  expiresIn: number;
};

/**
 * Port over the object store (RustFS with S3-compatible API). The application
 * asks for a presigned upload; the browser transfers bytes straight to storage,
 * so document data never passes through this service.
 */
export abstract class ObjectStorage {
  abstract presignUpload(input: PresignUploadInput): Promise<PresignedUpload>;
}
