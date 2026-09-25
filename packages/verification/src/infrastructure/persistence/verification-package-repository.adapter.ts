import { Inject, Injectable } from '@nestjs/common';

import {
  ConcurrencyConflictException,
  DomainEventPublisher,
} from '@cadastre/shared';

import { VerificationPackageRepository } from '../../application/ports/outbound/index.js';
import type { VerificationPackage } from '../../domain/aggregates/index.js';
import type { PackageId } from '../../domain/value-objects/index.js';

import type { Prisma } from './generated/client.js';
import { isStoredId } from './stored-id.js';
import {
  VerificationPackageMapper,
  type ArchiveSearchApprovalWrite,
  type CrossCheckWrite,
  type DocumentWrite,
  type PackageWrite,
  type PageWrite,
  type RegistryCheckWrite,
  type ReportWrite,
  type SourceFileWrite,
} from './verification-package.mapper.js';
import { VerificationPrismaService } from './verification-prisma.service.js';

const FIRST_STORED_VERSION = 1;

const WHOLE_AGGREGATE = {
  sourceFiles: {
    orderBy: { createdAt: 'asc' },
    include: {
      pages: { orderBy: { pageNumber: 'asc' }, include: { ocr: true } },
    },
  },
  documents: {
    orderBy: { firstPage: 'asc' },
    include: {
      extractedFields: { orderBy: { createdAt: 'asc' } },
      archiveQrCheck: { include: { fields: { orderBy: { position: 'asc' } } } },
      spanMarkup: {
        include: {
          notes: { orderBy: { position: 'asc' } },
          sheets: { orderBy: { position: 'asc' } },
        },
      },
    },
  },
  crossChecks: {
    orderBy: { key: 'asc' },
    include: { values: { orderBy: { position: 'asc' } } },
  },
  registryChecks: {
    orderBy: { key: 'asc' },
    include: {
      attributes: { orderBy: { position: 'asc' } },
      documents: { orderBy: { position: 'asc' } },
    },
  },
  // Only the approval in force: the aggregate decides with it, and a spent one
  // decides nothing (ADR-0016). At most one row answers this.
  archiveSearchApprovals: {
    where: { supersededAt: null },
    include: { checks: { orderBy: { position: 'asc' } } },
  },
  report: { include: { issues: { orderBy: { createdAt: 'asc' } } } },
} as const satisfies Prisma.VerificationPackageInclude;

@Injectable()
export class VerificationPackageRepositoryAdapter extends VerificationPackageRepository {
  constructor(
    @Inject(VerificationPrismaService)
    private readonly prisma: VerificationPrismaService,
    @Inject(DomainEventPublisher) private readonly events: DomainEventPublisher,
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

    await this.prisma.$transaction(async tx => {
      if (loadedAt === 0) {
        await this.insert(tx, row);
      } else {
        await this.updateAt(tx, row, loadedAt);
      }

      for (const file of row.sourceFiles) {
        await this.writeSourceFile(tx, row.id, file);
      }

      // Two passes over the documents, and the second one exists for the
      // self-reference: a replaced document points at the document that
      // replaced it, which is carved out of a file that arrived later and is
      // therefore written after it. Setting the column in the first pass would
      // name a row that is not there yet (COMM-80).
      const stored = new Map<string, string>();

      for (const document of row.documents) {
        stored.set(document.id, await this.writeDocument(tx, row.id, document));
      }

      for (const document of row.documents) {
        await this.writeSupersession(tx, stored, document);
      }

      for (const check of row.crossChecks) {
        await this.writeCrossCheck(tx, row.id, check);
      }

      for (const check of row.registryChecks) {
        await this.writeRegistryCheck(tx, row.id, check);
      }

      await this.writeArchiveSearchApproval(
        tx,
        row.id,
        row.archiveSearchApproval,
      );

      await this.writeReport(tx, row.id, row.report);

      // What the aggregate no longer holds is no longer in the package. Adding
      // a file discards every answer that was worked out across the package
      // (ADR-0013), and without this the discarded ones would sit in the
      // database describing an envelope that has since changed.
      await tx.crossCheck.deleteMany({
        where: {
          packageId: row.id,
          key: { notIn: row.crossChecks.map(check => check.key) },
        },
      });
      await tx.registryCheck.deleteMany({
        where: {
          packageId: row.id,
          key: { notIn: row.registryChecks.map(check => check.key) },
        },
      });
    });

    // After the write has landed, never before: an event names something that
    // has already happened.
    await this.events.dispatch(verificationPackage);
  }

  private async insert(
    tx: Prisma.TransactionClient,
    row: PackageWrite,
  ): Promise<void> {
    // Without its files: they are written below by the same code that writes a
    // file arriving later, so there is one way a source file reaches the
    // database rather than two that have to be kept in step (ADR-0013).
    await tx.verificationPackage.create({
      data: {
        id: row.id,
        status: row.status,
        profileKey: row.profileKey,
        // Written once, at submission, and never in the update below, for the
        // same reason as the declaration under it: who submitted a package is
        // fixed when it is taken in, and a package does not change hands
        // (ADR-0029).
        ownerAccountId: row.ownerAccountId,
        // Written once, at submission, and never in the update below: a
        // package's declaration is what the office said when it took the
        // submission in, and nothing that happens to it afterwards changes what
        // was said.
        declaredLegalBasis: row.declaredLegalBasis,
        declaredBuiltYear: row.declaredBuiltYear,
        version: FIRST_STORED_VERSION,
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
        'VerificationPackage',
        row.id,
        loadedAt,
      );
    }
  }

  // Upserted rather than created once with the package: a file may reach a
  // package that already exists, and the pages below hang off a row that has to
  // be there by then. Nothing about a stored file is ever updated — the name,
  // the type and the object it points at are what the inspector uploaded.
  private async writeSourceFile(
    tx: Prisma.TransactionClient,
    packageId: string,
    file: SourceFileWrite,
  ): Promise<void> {
    await tx.sourceFile.upsert({
      where: { id: file.id },
      create: {
        id: file.id,
        packageId,
        originalFilename: file.originalFilename,
        contentType: file.contentType,
        storageKey: file.storageKey,
        // What the operator sent it in for, written once with the row: it is
        // what was asked at the moment of upload, and nothing that happens
        // afterwards changes what was asked (COMM-80).
        suppliedForType: file.suppliedForType,
        suppliedForReplaces: file.suppliedForReplaces,
      },
      update: {},
    });

    for (const page of file.pages) {
      await this.writePage(tx, file.id, page);
    }
  }

  private async writeDocument(
    tx: Prisma.TransactionClient,
    packageId: string,
    document: DocumentWrite,
  ): Promise<string> {
    // Keyed on where the document starts in its file rather than on the id:
    // that is what a re-run of the segmentation stage identifies it by, so the
    // stage stays idempotent instead of writing a second copy.
    const stored = await tx.document.upsert({
      where: {
        sourceFileId_firstPage: {
          sourceFileId: document.sourceFileId,
          firstPage: document.firstPage,
        },
      },
      create: {
        id: document.id,
        sourceFileId: document.sourceFileId,
        packageId,
        firstPage: document.firstPage,
        lastPage: document.lastPage,
        type: document.type,
        classificationConfidence: document.classificationConfidence,
        knownAs: document.knownAs,
      },
      update: {
        lastPage: document.lastPage,
        type: document.type,
        classificationConfidence: document.classificationConfidence,
        knownAs: document.knownAs,
      },
    });

    /*
     * Gone from the aggregate means gone from the table.
     *
     * Deleted and not left behind, because a field can now be *dropped* rather
     * than only written: an operator states that the paper does not say what
     * the reader thought it did, and a value carried over loses the reading
     * that justified it (ADR-0023, ADR-0033). A row the aggregate no longer
     * holds would come back on the next read and be a value the package does
     * not state — and, worse, would go on answering cross-checks (COMM-122).
     */
    await tx.extractedField.deleteMany({
      where: {
        documentId: stored.id,
        name: { notIn: document.fields.map(field => field.name) },
      },
    });

    for (const field of document.fields) {
      await tx.extractedField.upsert({
        where: {
          documentId_name: { documentId: stored.id, name: field.name },
        },
        create: {
          documentId: stored.id,
          name: field.name,
          value: field.value,
          confidence: field.confidence,
          pageNumber: field.pageNumber,
          origin: field.origin,
          sourceDocumentId: field.sourceDocumentId,
          sourceDocumentType: field.sourceDocumentType,
          sourceFieldName: field.sourceFieldName,
          sourcePageNumber: field.sourcePageNumber,
          editedByAccountId: field.editedByAccountId,
          editedAt: field.editedAt,
        },
        // Every column, the source ones included: a field that was carried over
        // on one run and read on the next has to lose its source, or the row
        // would cite a paper the value no longer came from. The audit columns
        // are written the same way and for the same reason — a key an operator
        // corrected and the reader later re-read is no longer anybody's
        // correction.
        update: {
          value: field.value,
          confidence: field.confidence,
          pageNumber: field.pageNumber,
          origin: field.origin,
          sourceDocumentId: field.sourceDocumentId,
          sourceDocumentType: field.sourceDocumentType,
          sourceFieldName: field.sourceFieldName,
          sourcePageNumber: field.sourcePageNumber,
          editedByAccountId: field.editedByAccountId,
          editedAt: field.editedAt,
        },
      });
    }

    await this.writeArchiveQrCheck(tx, stored.id, document.archiveQrCheck);
    await this.writeSpanMarkup(tx, stored.id, document.spanMarkup);

    return stored.id;
  }

  /*
   * One markup per paper, replaced whole on a re-run: half of a picture drawn
   * off one reading beside half drawn off another is a picture of a reading
   * nobody made. A document the aggregate holds no markup for has none on file
   * either (COMM-165).
   *
   * The PNGs themselves are left where they are. They are written under the
   * document's own key, so a second run overwrites the pictures the first one
   * wrote rather than orphaning them — the same reason the rendered pages are
   * keyed off their original.
   */
  private async writeSpanMarkup(
    tx: Prisma.TransactionClient,
    documentId: string,
    markup: DocumentWrite['spanMarkup'],
  ): Promise<void> {
    if (!markup) {
      await tx.spanMarkup.deleteMany({ where: { documentId } });
      return;
    }

    const { sheets, notes, ...drawn } = markup;
    const stored = await tx.spanMarkup.upsert({
      where: { documentId },
      create: { documentId, ...drawn },
      update: drawn,
    });

    await tx.spanMarkupSheet.deleteMany({
      where: { spanMarkupId: stored.id },
    });
    await tx.spanMarkupSheet.createMany({
      data: sheets.map(sheet => ({ ...sheet, spanMarkupId: stored.id })),
    });

    await tx.spanMarkupNote.deleteMany({
      where: { spanMarkupId: stored.id },
    });
    await tx.spanMarkupNote.createMany({
      data: notes.map(note => ({ ...note, spanMarkupId: stored.id })),
    });
  }

  // One answer per paper, replaced whole on a re-run: half of an old comparison
  // beside a new one would be a comparison that never happened. A document the
  // aggregate holds no answer for has none on file either (ADR-0028).
  private async writeArchiveQrCheck(
    tx: Prisma.TransactionClient,
    documentId: string,
    check: DocumentWrite['archiveQrCheck'],
  ): Promise<void> {
    if (!check) {
      await tx.archiveQrCheck.deleteMany({ where: { documentId } });
      return;
    }

    const { fields, ...answer } = check;
    const stored = await tx.archiveQrCheck.upsert({
      where: { documentId },
      create: { documentId, ...answer },
      update: answer,
    });

    await tx.archiveQrCheckField.deleteMany({
      where: { archiveQrCheckId: stored.id },
    });
    await tx.archiveQrCheckField.createMany({
      data: fields.map(field => ({ ...field, archiveQrCheckId: stored.id })),
    });
  }

  /*
   * Which document replaced this one, and when — written after every document
   * of the package is on file, because the row it names may be one of them.
   *
   * Both columns every time and not only where one is set: the aggregate is
   * what the package is, and a write that could only ever mark a document
   * superseded would be one that cannot say a document is in force.
   *
   * The stored id and not the one in hand, for the reason the pages use it: a
   * document written by an earlier run keeps the id it was created with.
   */
  private async writeSupersession(
    tx: Prisma.TransactionClient,
    stored: ReadonlyMap<string, string>,
    document: DocumentWrite,
  ): Promise<void> {
    const id = stored.get(document.id);

    if (!id) return;

    await tx.document.update({
      where: { id },
      data: {
        supersededById: document.supersededById
          ? (stored.get(document.supersededById) ?? null)
          : null,
        supersededAt: document.supersededAt,
      },
    });
  }

  // Keyed on which check this is, so a re-run replaces the answer instead of
  // writing a second one. The values are replaced with it: they are the sides
  // the answer was made over, and half of an old comparison beside a new one
  // would be a comparison that never happened.
  private async writeCrossCheck(
    tx: Prisma.TransactionClient,
    packageId: string,
    check: CrossCheckWrite,
  ): Promise<void> {
    const stored = await tx.crossCheck.upsert({
      where: { packageId_key: { packageId, key: check.key } },
      create: {
        packageId,
        key: check.key,
        verdict: check.verdict,
        confidence: check.confidence,
        note: check.note,
        outrun: check.outrun,
      },
      update: {
        verdict: check.verdict,
        confidence: check.confidence,
        note: check.note,
        outrun: check.outrun,
      },
    });

    await tx.crossCheckValue.deleteMany({ where: { crossCheckId: stored.id } });
    await tx.crossCheckValue.createMany({
      data: check.values.map(value => ({
        ...value,
        crossCheckId: stored.id,
      })),
    });
  }

  // Keyed on which check this is, like a cross-check, and for the same reason:
  // a re-run asks the register again and replaces the answer rather than
  // writing a second one. The attributes go with it — half of an old comparison
  // beside a new one would be a comparison that never happened.
  private async writeRegistryCheck(
    tx: Prisma.TransactionClient,
    packageId: string,
    check: RegistryCheckWrite,
  ): Promise<void> {
    const { attributes, documents, ...answer } = check;

    const stored = await tx.registryCheck.upsert({
      where: { packageId_key: { packageId, key: check.key } },
      create: { packageId, ...answer },
      update: answer,
    });

    await tx.registryCheckAttribute.deleteMany({
      where: { registryCheckId: stored.id },
    });
    await tx.registryCheckAttribute.createMany({
      data: attributes.map(attribute => ({
        ...attribute,
        registryCheckId: stored.id,
      })),
    });

    await tx.registryCheckDocument.deleteMany({
      where: { registryCheckId: stored.id },
    });
    await tx.registryCheckDocument.createMany({
      data: documents.map(document => ({
        ...document,
        registryCheckId: stored.id,
      })),
    });
  }

  /*
   * The approval of the archive search, which is the one row here a person
   * wrote rather than the engine.
   *
   * Never updated and never deleted. An approval in force is a fact: the way it
   * ends is that the register is asked again, and then it is marked spent and
   * stays on file saying what was signed for and when it stopped counting
   * (ADR-0016). So there are exactly two moves — write the one the aggregate
   * has just given, or spend the one the aggregate no longer holds.
   */
  private async writeArchiveSearchApproval(
    tx: Prisma.TransactionClient,
    packageId: string,
    approval: ArchiveSearchApprovalWrite | null,
  ): Promise<void> {
    if (!approval) {
      await tx.archiveSearchApproval.updateMany({
        where: { packageId, supersededAt: null },
        data: { supersededAt: new Date() },
      });

      return;
    }

    // Already on file: nothing about a given approval ever changes, so this is
    // a save of a package that was approved earlier rather than a second
    // approval — the aggregate refuses those.
    const inForce = await tx.archiveSearchApproval.findFirst({
      where: { packageId, supersededAt: null },
      select: { id: true },
    });

    if (inForce) return;

    await tx.archiveSearchApproval.create({
      data: {
        packageId,
        summary: approval.summary,
        comment: approval.comment,
        checks: { create: approval.checks.map(check => ({ ...check })) },
      },
    });
  }

  private async writeReport(
    tx: Prisma.TransactionClient,
    packageId: string,
    report: ReportWrite | null,
  ): Promise<void> {
    // A package with no report is either one that has not been verified yet or
    // one whose report a later file made obsolete (ADR-0013). The row goes
    // either way: the aggregate is what the package is, and a report nobody
    // can reach from it would still be served by the read side.
    if (!report) {
      await tx.report.deleteMany({ where: { packageId } });
      return;
    }

    const stored = await tx.report.upsert({
      where: { packageId },
      create: { packageId, status: report.status },
      update: { status: report.status },
    });

    // Findings are replaced, never merged: the report is worked out from the
    // whole package each time it is compiled, so one the run has since answered
    // must not survive it.
    await tx.validationIssue.deleteMany({ where: { reportId: stored.id } });
    await tx.validationIssue.createMany({
      data: report.issues.map(issue => ({ ...issue, reportId: stored.id })),
    });
  }

  private async writePage(
    tx: Prisma.TransactionClient,
    sourceFileId: string,
    page: PageWrite,
  ): Promise<void> {
    // Keyed on (sourceFileId, pageNumber) rather than the id: which sheet this
    // is, is what a re-run of the split identifies it by.
    const stored = await tx.page.upsert({
      where: {
        sourceFileId_pageNumber: { sourceFileId, pageNumber: page.pageNumber },
      },
      create: {
        id: page.id,
        sourceFileId,
        pageNumber: page.pageNumber,
        imageStorageKey: page.imageStorageKey,
        imageContentType: page.imageContentType,
      },
      update: {
        imageStorageKey: page.imageStorageKey,
        imageContentType: page.imageContentType,
      },
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
        codes: [...page.ocr.codes],
      },
      update: {
        text: page.ocr.text,
        confidence: page.ocr.confidence,
        codes: [...page.ocr.codes],
      },
    });
  }
}
