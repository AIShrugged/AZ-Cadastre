import type {
  ContentType,
  Filename,
  StorageKey,
} from "../../domain/value-objects/index.js";

export type PresignUploadRequest = {
  filename: Filename;
  contentType: ContentType;
};

export type PresignedUpload = {
  key: StorageKey;
  url: string;
  contentType: ContentType;
  expiresIn: number;
};

export type PutObjectRequest = {
  key: StorageKey;
  body: Uint8Array;
  contentType: ContentType;
};

// A URL a browser can GET the object from directly, for a while. The inspector
// has to be able to look at the sheet a finding is about, and the bytes must not
// travel through the API to let them.
export type PresignedDownload = {
  url: string;
  expiresIn: number;
};

export type StoredObject = {
  body: Uint8Array;
  contentType: ContentType | null;
};

export abstract class ObjectStorage {
  abstract presignUpload(
    request: PresignUploadRequest,
  ): Promise<PresignedUpload>;

  // Server-side write, for objects the pipeline produces rather than a browser
  // uploads: a page image rendered off a PDF.
  abstract putObject(request: PutObjectRequest): Promise<void>;

  abstract presignDownload(key: StorageKey): Promise<PresignedDownload>;

  abstract getObject(key: StorageKey): Promise<StoredObject>;
}
