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

  abstract getObject(key: StorageKey): Promise<StoredObject>;
}
