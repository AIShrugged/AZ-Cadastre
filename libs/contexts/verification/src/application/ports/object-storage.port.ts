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

export type StoredObject = {
  body: Uint8Array;
  contentType: ContentType | null;
};

export abstract class ObjectStorage {
  abstract presignUpload(
    request: PresignUploadRequest,
  ): Promise<PresignedUpload>;

  abstract getObject(key: StorageKey): Promise<StoredObject>;
}
