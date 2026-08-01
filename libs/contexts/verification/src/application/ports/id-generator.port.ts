import type {
  DocumentId,
  PackageId,
  PageId,
  SourceFileId,
} from "../../domain/value-objects/index.js";

export abstract class IdGenerator {
  abstract packageId(): PackageId;
  abstract sourceFileId(): SourceFileId;
  abstract documentId(): DocumentId;
  abstract pageId(): PageId;
}
