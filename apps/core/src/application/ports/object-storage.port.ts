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

/** Bytes of a stored object, plus its content type when the store reports one. */
export type StoredObject = {
  body: Uint8Array;
  contentType?: string;
};

/**
 * Port over the object store (RustFS with S3-compatible API). Uploads go
 * browser→storage via a presigned URL (bytes never touch this service), but
 * server-side stages (e.g. real OCR) can pull an object's bytes back down.
 */
export abstract class ObjectStorage {
  abstract presignUpload(input: PresignUploadInput): Promise<PresignedUpload>;
  /** Fetch a stored object's raw bytes by key. */
  abstract getObject(key: string): Promise<StoredObject>;
}
