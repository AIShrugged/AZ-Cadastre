import { Injectable } from "@nestjs/common";

import {
  PipelineStore,
  type NewPage,
  type OcrResultInput,
  type PipelinePackage,
  type PipelinePage,
} from "../../../application/ports/pipeline-store.port.js";
import type { PackageStatus } from "../generated/enums.js";
import type { Prisma } from "../generated/client.js";
import { PrismaService } from "../prisma.service.js";

/** Prisma-backed {@link PipelineStore} (ADR-0004: infrastructure layer). */
@Injectable()
export class PrismaPipelineStore extends PipelineStore {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async getPackage(packageId: string): Promise<PipelinePackage | null> {
    const pkg = await this.prisma.verificationPackage.findUnique({
      where: { id: packageId },
      select: {
        id: true,
        profileKey: true,
        documents: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            originalFilename: true,
            contentType: true,
            storageKey: true,
            pages: {
              orderBy: { pageNumber: "asc" },
              select: {
                id: true,
                pageNumber: true,
                imageStorageKey: true,
                ocr: { select: { text: true } },
              },
            },
          },
        },
      },
    });
    if (!pkg) return null;
    return {
      id: pkg.id,
      profileKey: pkg.profileKey,
      documents: pkg.documents.map((doc) => ({
        id: doc.id,
        originalFilename: doc.originalFilename,
        contentType: doc.contentType,
        storageKey: doc.storageKey,
        pages: doc.pages.map((page) => ({
          id: page.id,
          pageNumber: page.pageNumber,
          imageStorageKey: page.imageStorageKey,
          ocrText: page.ocr?.text ?? null,
        })),
      })),
    };
  }

  async setPackageStatus(
    packageId: string,
    status: PackageStatus,
  ): Promise<void> {
    await this.prisma.verificationPackage.update({
      where: { id: packageId },
      data: { status },
    });
  }

  async createPages(
    documentId: string,
    pages: NewPage[],
  ): Promise<PipelinePage[]> {
    const created = await this.prisma.page.createManyAndReturn({
      data: pages.map((p) => ({
        documentId,
        pageNumber: p.pageNumber,
        imageStorageKey: p.imageStorageKey,
      })),
      select: { id: true, pageNumber: true, imageStorageKey: true },
    });
    return created.map((p) => ({
      id: p.id,
      pageNumber: p.pageNumber,
      imageStorageKey: p.imageStorageKey,
      ocrText: null,
    }));
  }

  async saveOcrResult(pageId: string, result: OcrResultInput): Promise<void> {
    const boxes = result.boxes as Prisma.InputJsonValue | undefined;
    await this.prisma.ocrResult.upsert({
      where: { pageId },
      create: {
        pageId,
        text: result.text,
        confidence: result.confidence,
        ...(boxes !== undefined ? { boxes } : {}),
      },
      update: {
        text: result.text,
        confidence: result.confidence,
        ...(boxes !== undefined ? { boxes } : {}),
      },
    });
  }

  async setDocumentType(documentId: string, type: string): Promise<void> {
    await this.prisma.document.update({
      where: { id: documentId },
      data: { type },
    });
  }
}
