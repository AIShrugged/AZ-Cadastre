import { AggregateRoot } from "@cadastre/kernel";

import { type Document, type ExtractedField, type Page } from "../entities/index.js";
import {
  DocumentClassified,
  DocumentSplitIntoPages,
  FieldsExtracted,
  PackageSubmitted,
  PageRecognised,
  VerificationCompleted,
  VerificationFailed,
  VerificationStarted,
} from "../events/index.js";
import {
  DocumentNotInPackageException,
  DocumentTypeNotInProfileException,
  DuplicateStorageKeyException,
  FieldNotInSchemaException,
  PackageAlreadyFinishedException,
  PackageMustHaveADocumentException,
  PackageNotStartableException,
  PackageNotUnderWayException,
} from "../exceptions/index.js";
import {
  type Classification,
  type DocumentId,
  FailureReason,
  type OcrResult,
  PackageId,
  PackageStatus,
  type PageId,
  type VerificationProfile,
} from "../value-objects/index.js";

export type VerificationPackageState = {
  readonly id: PackageId;
  readonly version: number;
  readonly profile: VerificationProfile;
  readonly status: PackageStatus;
  readonly documents: readonly Document[];
};

export class VerificationPackage extends AggregateRoot<PackageId> {
  readonly #profile: VerificationProfile;
  #status: PackageStatus;
  #documents: Document[];

  private constructor(state: VerificationPackageState) {
    super(state.id, state.version);
    this.#profile = state.profile;
    this.#status = state.status;
    this.#documents = [...state.documents];
  }

  static create(
    id: PackageId,
    profile: VerificationProfile,
    documents: readonly Document[],
  ): VerificationPackage {
    if (documents.length === 0) throw new PackageMustHaveADocumentException();

    const seen = new Set<string>();
    for (const document of documents) {
      if (seen.has(document.storageKey.value)) {
        throw new DuplicateStorageKeyException(document.storageKey.value);
      }
      seen.add(document.storageKey.value);
    }

    const submitted = new VerificationPackage({
      id,
      version: 0,
      profile,
      status: PackageStatus.PENDING,
      documents,
    });

    submitted.apply(new PackageSubmitted(id, profile, documents.length));

    return submitted;
  }

  static restore(state: VerificationPackageState): VerificationPackage {
    return new VerificationPackage(state);
  }

  get profile(): VerificationProfile {
    return this.#profile;
  }

  get status(): PackageStatus {
    return this.#status;
  }

  get documents(): readonly Document[] {
    return this.#documents;
  }

  documentWith(documentId: DocumentId): Document {
    const document = this.#documents.find((candidate) =>
      candidate.id.equals(documentId),
    );

    if (!document) {
      throw new DocumentNotInPackageException(documentId.value, this.id.value);
    }

    return document;
  }

  get isFullyProcessed(): boolean {
    return this.#documents.every(
      (document) =>
        document.isFullyRecognised &&
        document.isClassified &&
        (document.hasFields || !this.expectsFieldsOf(document)),
    );
  }

  start(): void {
    if (!this.#status.canStart) {
      throw new PackageNotStartableException(this.id.value, this.#status.value);
    }

    this.#status = PackageStatus.PROCESSING;
    this.apply(new VerificationStarted(this.id));
  }

  splitIntoPages(documentId: DocumentId, pages: readonly Page[]): void {
    this.guardUnderWay();
    const document = this.documentWith(documentId);

    this.replace(document.splitInto(pages));
    this.apply(new DocumentSplitIntoPages(this.id, documentId, pages.length));
  }

  recordRecognition(
    documentId: DocumentId,
    pageId: PageId,
    ocr: OcrResult,
  ): void {
    this.guardUnderWay();
    const document = this.documentWith(documentId);

    this.replace(document.recognised(pageId, ocr));
    this.apply(new PageRecognised(this.id, documentId, pageId));
  }

  classify(documentId: DocumentId, classification: Classification): void {
    this.guardUnderWay();
    const document = this.documentWith(documentId);

    if (
      classification.isPlaced &&
      !this.#profile.recognises(classification.type)
    ) {
      throw new DocumentTypeNotInProfileException(
        classification.type.value,
        this.#profile.key,
      );
    }

    this.replace(document.classifiedAs(classification));
    this.apply(new DocumentClassified(this.id, documentId, classification));
  }

  recordExtractedFields(
    documentId: DocumentId,
    fields: readonly ExtractedField[],
  ): void {
    this.guardUnderWay();
    const document = this.documentWith(documentId);
    const classification = document.classification;

    if (classification?.isPlaced) {
      const schema = this.#profile.schemaFor(classification.type);
      for (const field of fields) {
        if (!schema.declares(field.key)) {
          throw new FieldNotInSchemaException(
            field.key.value,
            classification.type.value,
          );
        }
      }
    }

    this.replace(document.withFields(fields));
    this.apply(new FieldsExtracted(this.id, documentId, fields.length));
  }

  complete(): void {
    this.guardUnderWay();

    this.#status = PackageStatus.COMPLETED;
    this.apply(new VerificationCompleted(this.id));
  }

  fail(reason: FailureReason): void {
    if (this.#status.isTerminal) {
      throw new PackageAlreadyFinishedException(this.id.value, this.#status.value);
    }

    this.#status = PackageStatus.FAILED;
    this.apply(new VerificationFailed(this.id, reason));
  }

  private expectsFieldsOf(document: Document): boolean {
    const classification = document.classification;

    if (!classification?.isPlaced) return false;

    return !this.#profile.schemaFor(classification.type).isEmpty;
  }

  private guardUnderWay(): void {
    if (!this.#status.isUnderWay) {
      throw new PackageNotUnderWayException(this.id.value, this.#status.value);
    }
  }

  private replace(document: Document): void {
    this.#documents = this.#documents.map((candidate) =>
      candidate.id.equals(document.id) ? document : candidate,
    );
  }
}
