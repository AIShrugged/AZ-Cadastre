import { Inject, Injectable } from '@nestjs/common';

import {
  PackageQueries,
  type PackageListCriteria,
  type PackageListPage,
} from '../../application/ports/outbound/index.js';
import type {
  CrossCheckView,
  PackageDetailView,
  PackageSummaryView,
  RegistryCheckView,
  ReportView,
} from '../../application/read-models/index.js';
import {
  DocumentType,
  IssueKind,
  PackageStanding,
  PackageStatus,
  ReportStatus,
  type PackageId,
} from '../../domain/value-objects/index.js';

import type { $Enums, Prisma } from './generated/client.js';
import { isStoredId, isUuid } from './stored-id.js';
import { VerificationPrismaService } from './verification-prisma.service.js';

const ISSUE_COLUMNS = {
  kind: true,
  message: true,
  documentId: true,
  sourceFileId: true,
  documentType: true,
  fieldName: true,
  checkKey: true,
  pageNumber: true,
  confidence: true,
} as const satisfies Prisma.ValidationIssueSelect;

// The value a check was made from, wherever one is stored: a cross-check's
// values, a registry check's subject, a registry attribute. Same six columns
// every time, so they are named once.
const CHECKED_VALUE_COLUMNS = {
  documentId: true,
  documentType: true,
  fieldName: true,
  value: true,
  pageNumber: true,
  confidence: true,
} as const;

const CROSS_CHECK_COLUMNS = {
  orderBy: { key: 'asc' },
  select: {
    key: true,
    verdict: true,
    confidence: true,
    note: true,
    values: {
      orderBy: { position: 'asc' },
      select: CHECKED_VALUE_COLUMNS,
    },
  },
} as const satisfies Prisma.VerificationPackage$crossChecksArgs;

const REGISTRY_CHECK_COLUMNS = {
  orderBy: { key: 'asc' },
  select: {
    key: true,
    outcome: true,
    confidence: true,
    note: true,
    reference: true,
    // The address that was asked about. Its confidence is stored apart from the
    // check's own, which is the floor of every reading the check was made from.
    documentId: true,
    documentType: true,
    fieldName: true,
    value: true,
    pageNumber: true,
    valueConfidence: true,
    attributes: {
      orderBy: { position: 'asc' },
      select: {
        name: true,
        agrees: true,
        recorded: true,
        ...CHECKED_VALUE_COLUMNS,
      },
    },
    documents: {
      orderBy: { position: 'asc' },
      select: {
        name: true,
        holding: true,
        recordedNumber: true,
        recordedDate: true,
        reference: true,
        documentId: true,
        documentType: true,
        pageNumber: true,
      },
    },
  },
} as const satisfies Prisma.VerificationPackage$registryChecksArgs;

const SUMMARY_COLUMNS = {
  id: true,
  status: true,
  profileKey: true,
  createdAt: true,
  updatedAt: true,
  // The registry checks are counted and not read: whether the register was
  // asked anything at all is what the standing turns on, and what it answered
  // is the detail view's business.
  _count: { select: { sourceFiles: true, registryChecks: true } },
  documents: {
    select: {
      type: true,
      _count: { select: { extractedFields: true } },
    },
  },
  // The register only tallies findings; the whole of each one is the detail
  // view's business.
  report: { select: { status: true, issues: { select: { kind: true } } } },
} as const satisfies Prisma.VerificationPackageSelect;

const REPORT_COLUMNS = {
  select: {
    status: true,
    generatedAt: true,
    issues: { orderBy: { createdAt: 'asc' }, select: ISSUE_COLUMNS },
  },
} as const satisfies Prisma.VerificationPackage$reportArgs;

type IssueRow = {
  readonly kind: string;
  readonly message: string;
  readonly documentId: string | null;
  readonly sourceFileId: string | null;
  readonly documentType: string | null;
  readonly fieldName: string | null;
  readonly checkKey: string | null;
  readonly pageNumber: number | null;
  readonly confidence: number | null;
};

type CrossCheckRow = {
  readonly key: string;
  readonly verdict: string;
  readonly confidence: number;
  readonly note: string;
  readonly values: readonly {
    readonly documentId: string | null;
    readonly documentType: string;
    readonly fieldName: string;
    readonly value: string;
    readonly pageNumber: number;
    readonly confidence: number;
  }[];
};

type RegistryCheckRow = {
  readonly key: string;
  readonly outcome: string;
  readonly confidence: number;
  readonly note: string;
  readonly reference: string | null;
  readonly documentId: string | null;
  readonly documentType: string;
  readonly fieldName: string;
  readonly value: string;
  readonly pageNumber: number;
  readonly valueConfidence: number;
  readonly attributes: readonly {
    readonly name: string;
    readonly agrees: boolean;
    readonly recorded: string | null;
    readonly documentId: string | null;
    readonly documentType: string;
    readonly fieldName: string;
    readonly value: string;
    readonly pageNumber: number;
    readonly confidence: number;
  }[];
  readonly documents: readonly {
    readonly name: string;
    readonly holding: string;
    readonly recordedNumber: string | null;
    readonly recordedDate: string | null;
    readonly reference: string | null;
    readonly documentId: string | null;
    readonly documentType: string;
    readonly pageNumber: number;
  }[];
};

type SummaryRow = {
  readonly id: string;
  readonly status: string;
  readonly profileKey: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly _count: {
    readonly sourceFiles: number;
    readonly registryChecks: number;
  };
  readonly documents: readonly {
    readonly type: string | null;
    readonly _count: { readonly extractedFields: number };
  }[];
  readonly report: {
    readonly status: string;
    readonly issues: readonly { readonly kind: string }[];
  } | null;
};

type DetailReportRow = {
  readonly status: string;
  readonly generatedAt: Date;
  readonly issues: readonly IssueRow[];
};

@Injectable()
export class PackageQueriesAdapter extends PackageQueries {
  constructor(
    @Inject(VerificationPrismaService)
    private readonly prisma: VerificationPrismaService,
  ) {
    super();
  }

  async listSummaries(criteria: PackageListCriteria): Promise<PackageListPage> {
    const where = PackageQueriesAdapter.matching(criteria);

    // The page and the tally in one transaction: taken apart, a submission
    // accepted between them would leave a pager saying there are eleven rows
    // over a page that is one of ten.
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.verificationPackage.findMany({
        where,
        // Newest first, and the id to settle a tie. Two packages accepted in
        // the same millisecond have no order of their own, and without one the
        // database is free to answer them differently on two calls — which on a
        // paged list shows one of them twice and the other never.
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: criteria.offset,
        take: criteria.limit,
        select: SUMMARY_COLUMNS,
      }),
      this.prisma.verificationPackage.count({ where }),
    ]);

    return {
      items: rows.map(row => PackageQueriesAdapter.toSummary(row)),
      total,
    };
  }

  async findSummary(id: PackageId): Promise<PackageSummaryView | null> {
    if (!isStoredId(id)) return null;

    const row = await this.prisma.verificationPackage.findUnique({
      where: { id: id.value },
      select: SUMMARY_COLUMNS,
    });

    return row ? PackageQueriesAdapter.toSummary(row) : null;
  }

  async findDetail(id: PackageId): Promise<PackageDetailView | null> {
    if (!isStoredId(id)) return null;

    const row = await this.prisma.verificationPackage.findUnique({
      where: { id: id.value },
      select: {
        ...SUMMARY_COLUMNS,
        report: REPORT_COLUMNS,
        crossChecks: CROSS_CHECK_COLUMNS,
        registryChecks: REGISTRY_CHECK_COLUMNS,
        sourceFiles: {
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            originalFilename: true,
            contentType: true,
            pages: {
              orderBy: { pageNumber: 'asc' },
              select: {
                pageNumber: true,
                imageStorageKey: true,
                ocr: { select: { text: true, confidence: true } },
              },
            },
            documents: {
              orderBy: { firstPage: 'asc' },
              select: {
                id: true,
                firstPage: true,
                lastPage: true,
                type: true,
                classificationConfidence: true,
                extractedFields: {
                  orderBy: { createdAt: 'asc' },
                  select: {
                    name: true,
                    value: true,
                    confidence: true,
                    pageNumber: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!row) return null;

    return {
      ...PackageQueriesAdapter.toSummary(row),
      report: PackageQueriesAdapter.toReport(row.report),
      crossChecks: row.crossChecks.map(check =>
        PackageQueriesAdapter.toCrossCheck(check),
      ),
      registryChecks: row.registryChecks.map(check =>
        PackageQueriesAdapter.toRegistryCheck(check),
      ),
      files: row.sourceFiles.map(file => ({
        id: file.id,
        originalFilename: file.originalFilename,
        contentType: file.contentType,
        pages: file.pages.map(page => ({
          pageNumber: page.pageNumber,
          imageStorageKey: page.imageStorageKey,
          // Signed by the use case, which is where reaching object storage
          // belongs; the register only knows where the sheet is kept.
          imageUrl: null,
          ocr: page.ocr
            ? { text: page.ocr.text, confidence: page.ocr.confidence }
            : null,
        })),
        documents: file.documents.map(document => ({
          id: document.id,
          firstPage: document.firstPage,
          lastPage: document.lastPage,
          type: document.type,
          classificationConfidence: document.classificationConfidence,
          fields: document.extractedFields.map(field => ({
            name: field.name,
            value: field.value,
            confidence: field.confidence,
            pageNumber: field.pageNumber,
          })),
        })),
      })),
    };
  }

  /**
   * The criteria as one condition the database can answer, so the filter, the
   * page and the tally are all decided by Postgres. Narrowing a page in
   * application code would mean reading every submission the office has ever
   * taken in to answer a screen that shows twenty of them.
   */
  private static matching(
    criteria: PackageListCriteria,
  ): Prisma.VerificationPackageWhereInput {
    const conditions: Prisma.VerificationPackageWhereInput[] = [];

    if (criteria.search !== null) {
      conditions.push(PackageQueriesAdapter.matchingSearch(criteria.search));
    }

    if (criteria.standing !== null) {
      conditions.push(PackageQueriesAdapter.standingIs(criteria.standing));
    }

    if (criteria.reportStatus !== null) {
      conditions.push({
        // Only ever written through the domain's own enumeration, so the value
        // is one the column names.
        report: {
          status: criteria.reportStatus.value as $Enums.ReportStatus,
        },
      });
    }

    // The search and the two filters narrow together: a term inside a standing,
    // not a term or a standing.
    return conditions.length > 0 ? { AND: conditions } : {};
  }

  /**
   * What a search term matches, and the whole of it: the package's own id, the
   * name of a file uploaded to it, or a value the pipeline read off one of its
   * documents.
   *
   * Case is ignored; letters are not folded. "Elçin" and "Elcin" are two terms
   * here, and deliberately: the rules that decide two spellings of one
   * Azerbaijani name mean the same thing live in `@cadastre/matching-engine`,
   * which this context may not import and which answers about a pair of values
   * it already holds rather than about a table it has not read. Why that is the
   * right way round, and what would change it: ADR-0015.
   */
  private static matchingSearch(
    term: string,
  ): Prisma.VerificationPackageWhereInput {
    const anywhere = { contains: term, mode: 'insensitive' } as const;

    return {
      OR: [
        /*
         * A term that is a uuid is the package's own id — that is what an
         * inspector pastes out of a link or a mail. Held whole rather than as a
         * prefix: the column is `uuid`, and Postgres matches no pattern against
         * one.
         */
        ...(isUuid(term) ? [{ id: term }] : []),
        { sourceFiles: { some: { originalFilename: anywhere } } },
        {
          documents: {
            some: { extractedFields: { some: { value: anywhere } } },
          },
        },
      ],
    };
  }

  /**
   * Where a submission stands, as a condition over the columns it is worked out
   * from.
   *
   * The standing is derived and stored nowhere (ADR-0014), so there is no
   * column to compare — and writing the derivation out a second time in SQL is
   * how the row that leads to a card comes to disagree with the card. So the
   * combinations come from the rule itself: `PackageStanding.facts` runs the
   * derivation over every fact a package can hold and answers with the ones
   * that land on this standing.
   */
  private static standingIs(
    standing: PackageStanding,
  ): Prisma.VerificationPackageWhereInput {
    // Nothing can approve an archive search yet — the approval is COMM-40 — so
    // the facts that need one describe no row. The same `false` the summary is
    // worked out with.
    const reachable = standing.facts.filter(
      facts => !facts.archiveSearchApproved,
    );

    /*
     * One branch per (status, report) pair, with the register only named where
     * the pair does not hold either way. Without the collapse a standing like
     * Stalled — which every report value and both answers reach — would be ten
     * branches saying what five say.
     */
    const branches = new Map<
      string,
      { status: string; report: string | null; asked: Set<boolean> }
    >();

    for (const facts of reachable) {
      const report = facts.report?.value ?? null;
      const key = `${facts.status.value}|${report ?? ''}`;
      const branch = branches.get(key) ?? {
        status: facts.status.value,
        report,
        asked: new Set<boolean>(),
      };

      branch.asked.add(facts.askedTheArchive);
      branches.set(key, branch);
    }

    return {
      OR: [...branches.values()].map(branch => ({
        // Only ever written through the domain's own enumerations, so the
        // values are ones the columns name.
        status: branch.status as $Enums.PackageStatus,
        report:
          branch.report === null
            ? { is: null }
            : { status: branch.report as $Enums.ReportStatus },
        // Whether the archive register was asked anything about this package.
        // Counted rather than read: what it answered is the detail view's
        // business, and whether it was asked at all is what the standing turns
        // on.
        ...(branch.asked.size === 2
          ? {}
          : {
              registryChecks: branch.asked.has(true)
                ? { some: {} }
                : { none: {} },
            }),
      })),
    };
  }

  private static toCrossCheck(row: CrossCheckRow): CrossCheckView {
    return {
      key: row.key,
      verdict: row.verdict,
      confidence: row.confidence,
      note: row.note,
      values: row.values.map(value => ({
        documentId: value.documentId,
        documentType: value.documentType,
        fieldName: value.fieldName,
        value: value.value,
        pageNumber: value.pageNumber,
        confidence: value.confidence,
      })),
    };
  }

  private static toRegistryCheck(row: RegistryCheckRow): RegistryCheckView {
    return {
      key: row.key,
      // Only ever written through the domain's own enumeration, so the stored
      // string is one the contract names.
      outcome: row.outcome,
      confidence: row.confidence,
      note: row.note,
      asked: {
        documentId: row.documentId,
        documentType: row.documentType,
        fieldName: row.fieldName,
        value: row.value,
        pageNumber: row.pageNumber,
        confidence: row.valueConfidence,
      },
      reference: row.reference,
      documents: row.documents.map(document => ({
        name: document.name,
        // Only ever written through the domain's own enumeration, so the stored
        // string is one the contract names.
        holding: document.holding,
        number: document.recordedNumber,
        issuedOn: document.recordedDate,
        reference: document.reference,
        documentId: document.documentId,
        documentType: document.documentType,
        pageNumber: document.pageNumber,
      })),
      attributes: row.attributes.map(attribute => ({
        name: attribute.name,
        agrees: attribute.agrees,
        recorded: attribute.recorded,
        submitted: {
          documentId: attribute.documentId,
          documentType: attribute.documentType,
          fieldName: attribute.fieldName,
          value: attribute.value,
          pageNumber: attribute.pageNumber,
          confidence: attribute.confidence,
        },
      })),
    };
  }

  private static toReport(row: DetailReportRow | null): ReportView | null {
    if (!row) return null;

    return {
      status: row.status,
      generatedAt: row.generatedAt,
      issues: row.issues.map(issue => ({
        kind: issue.kind,
        message: issue.message,
        documentId: issue.documentId,
        sourceFileId: issue.sourceFileId,
        documentType: issue.documentType,
        fieldName: issue.fieldName,
        checkKey: issue.checkKey,
        pageNumber: issue.pageNumber,
        confidence: issue.confidence,
      })),
    };
  }

  private static toSummary(row: SummaryRow): PackageSummaryView {
    const issues = row.report?.issues ?? [];

    return {
      id: row.id,
      status: row.status,
      // Worked out here rather than in the mapper, and by the domain's own rule
      // rather than a second copy of it: a card and the row that leads to it
      // disagreeing about where a submission stands is exactly what two
      // implementations of one rule produce (ADR-0014). Both columns are
      // database enumerations, so neither parse can fail on a stored row.
      standing: PackageStanding.of({
        status: PackageStatus.of(row.status),
        report: row.report ? ReportStatus.of(row.report.status) : null,
        askedTheArchive: row._count.registryChecks > 0,
        // Nothing can approve an archive search yet; the approval is COMM-40.
        archiveSearchApproved: false,
      }).value,
      profileKey: row.profileKey,
      filesCount: row._count.sourceFiles,
      // Zero until the Segmentation stage has read the files: how many
      // documents a package holds is something the pipeline discovers, not
      // something the upload declared.
      documentsCount: row.documents.length,
      classifiedCount: row.documents.filter(document => document.type !== null)
        .length,
      unclassifiedCount: row.documents.filter(
        document => document.type === DocumentType.UNKNOWN.value,
      ).length,
      extractedCount: row.documents.filter(
        document => document._count.extractedFields > 0,
      ).length,
      reportStatus: row.report?.status ?? null,
      // A reading the engine is unsure of is reported apart from a shortfall in
      // the package itself: the register says both, and together they are every
      // finding the report holds against the package.
      issuesCount: issues.filter(
        issue =>
          PackageQueriesAdapter.isAgainstPackage(issue.kind) &&
          issue.kind !== IssueKind.LOW_CONFIDENCE.value,
      ).length,
      lowConfidenceCount: issues.filter(
        issue => issue.kind === IssueKind.LOW_CONFIDENCE.value,
      ).length,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }

  /**
   * Whether a finding is held against the package, by the domain's own rule —
   * the one `VerificationReport` decides OK against, and the one the detail
   * screen counts its worklist by.
   *
   * The register used to count everything that was not a low-confidence
   * reading, which swept in the observations: a package carrying four of the
   * registry's own service sheets was announced as having four замечаний, and
   * the same package's card, counting by tone, disagreed with the row that led
   * to it. An observation is stated for the record and never against the
   * package, so it is not what the register tallies.
   *
   * A kind the enumeration does not know is counted rather than thrown on: the
   * register is a read surface, and one unrecognised row must not take the
   * whole list down.
   */
  private static isAgainstPackage(kind: string): boolean {
    const known = IssueKind.all.find(candidate => candidate.value === kind);

    return known ? !known.isInformational : true;
  }
}
