import type {
  DocumentId,
  PackageId,
  PageId,
} from "../../domain/value-objects/index.js";

export abstract class IdGenerator {
  abstract packageId(): PackageId;
  abstract documentId(): DocumentId;
  abstract pageId(): PageId;
}
