import type {
  ContentType,
  OcrResult,
  StorageKey,
} from "../../domain/value-objects/index.js";

export type OcrPageRequest = {
  imageStorageKey: StorageKey;
  contentType: ContentType;
};

export abstract class OcrProvider {
  abstract recognise(request: OcrPageRequest): Promise<OcrResult>;
}
