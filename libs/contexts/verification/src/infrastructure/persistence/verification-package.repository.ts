import { Injectable } from "@nestjs/common";
import {
  ConcurrencyConflictException,
  DomainEventDispatcher,
} from "@cadastre/application";

import type { VerificationPackage } from "../../domain/aggregates/index.js";
import { VerificationPackageRepository } from "../../domain/repositories/index.js";
import type { PackageId } from "../../domain/value-objects/index.js";
import type { Prisma } from "./generated/client.js";
import { isStoredId } from "./stored-id.js";
import {
  type DocumentWrite,
  type PackageWrite,
  type PageWrite,
  VerificationPackageMapper,
} from "./verification-package.mapper.js";
import { VerificationPrismaService } from "./verification-prisma.service.js";

const FIRST_STORED_VERSION = 1;

const WHOLE_AGGREGATE = {
  documents: {
    orderBy: { createdAt: "asc" },
    include: {
      pages: { orderBy: { pageNumber: "asc" }, include: { ocr: true } },
      extractedFields: { orderBy: { createdAt: "asc" } },
    },
  },
} as const satisfies Prisma.VerificationPackageInclude;

@Injectable()
export class PrismaVerificationPackageRepository extends VerificationPackageRepository {
  constructor(
    private readonly prisma: VerificationPrismaService,
    private readonly dispatcher: DomainEventDispatcher,
  ) {
    super();
  }

  async findById(id: PackageId): Promise<VerificationPackage | null> {
    if (!isStoredId(id)) return null;

    const row = await this.prisma.verificationPackage.findUnique({
      where: { id: id.value },
      include: WHOLE_AGGREGATE,
    });

    if (!row) return null;

    return VerificationPackageMapper.toDomain(row);
  }

  async save(verificationPackage: VerificationPackage): Promise<void> {
    const row = VerificationPackageMapper.toRow(verificationPackage);
    const loadedAt = verificationPackage.version;

    await this.prisma.$transaction(async (tx) => {
      if (loadedAt === 0) {
        await this.insert(tx, row);
      } else {
        await this.updateAt(tx, row, loadedAt);
      }

      for (const document of row.documents) {
        await this.writeDocument(tx, document);
      }
    });

    // After the write has landed, never before: an event names something that
    // has already happened.
    await this.dispatcher.dispatch(verificationPackage);
  }

  private async insert(
    tx: Prisma.TransactionClient,
    row: PackageWrite,
  ): Promise<void> {
    await tx.verificationPackage.create({
      data: {
        id: row.id,
        status: row.status,
        profileKey: row.profileKey,
        version: FIRST_STORED_VERSION,
        documents: {
          create: row.documents.map((document) => ({
            id: document.id,
            originalFilename: document.originalFilename,
            contentType: document.contentType,
            storageKey: document.storageKey,
          })),
        },
      },
    });
  }

  private async updateAt(
    tx: Prisma.TransactionClient,
    row: PackageWrite,
    loadedAt: number,
  ): Promise<void> {
    const { count } = await tx.verificationPackage.updateMany({
      where: { id: row.id, version: loadedAt },
      data: {
        status: row.status,
        profileKey: row.profileKey,
        version: loadedAt + 1,
      },
    });

    // No row at that version: it moved under this use case, or it is not there
    // at all — the same answer to the caller either way.
    if (count === 0) {
      throw new ConcurrencyConflictException(
        "VerificationPackage",
        row.id,
        loadedAt,
      );
    }
  }

  private async writeDocument(
    tx: Prisma.TransactionClient,
    document: DocumentWrite,
  ): Promise<void> {
    await tx.document.update({
      where: { id: document.id },
      data: {
        type: document.type,
        classificationConfidence: document.classificationConfidence,
      },
    });

    for (const page of document.pages) {
      await this.writePage(tx, document.id, page);
    }

    for (const field of document.fields) {
      await tx.extractedField.upsert({
        where: {
          documentId_name: { documentId: document.id, name: field.name },
        },
        create: {
          documentId: document.id,
          name: field.name,
          value: field.value,
          confidence: field.confidence,
          pageNumber: field.pageNumber,
        },
        update: {
          value: field.value,
          confidence: field.confidence,
          pageNumber: field.pageNumber,
        },
      });
    }
  }

  private async writePage(
    tx: Prisma.TransactionClient,
    documentId: string,
    page: PageWrite,
  ): Promise<void> {
    // Keyed on (documentId, pageNumber) rather than the id: which sheet this is,
    // is what a re-run of the split identifies it by.
    const stored = await tx.page.upsert({
      where: {
        documentId_pageNumber: { documentId, pageNumber: page.pageNumber },
      },
      create: {
        id: page.id,
        documentId,
        pageNumber: page.pageNumber,
        imageStorageKey: page.imageStorageKey,
      },
      update: { imageStorageKey: page.imageStorageKey },
    });

    if (!page.ocr) return;

    // The stored id, not the one in hand: a page written by an earlier run keeps
    // the id it was created with.
    await tx.ocrResult.upsert({
      where: { pageId: stored.id },
      create: {
        pageId: stored.id,
        text: page.ocr.text,
        confidence: page.ocr.confidence,
      },
      update: { text: page.ocr.text, confidence: page.ocr.confidence },
    });
  }
}
