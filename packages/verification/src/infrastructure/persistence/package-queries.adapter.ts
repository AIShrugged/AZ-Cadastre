import { Inject, Injectable } from '@nestjs/common';

import {
  PackageQueries,
  type OverviewPeriod,
  type PackageListCriteria,
  type PackageListPage,
} from '../../application/ports/outbound/index.js';
import type {
  ArchiveSearchApprovalView,
  CrossCheckView,
  FindingCountView,
  FindingsOverviewView,
  FindingTallyView,
  PackageDetailView,
  PackagesOverviewView,
  PackageSummaryView,
  RegistryCheckView,
  ReportView,
  StatedValueView,
  TallyView,
} from '../../application/read-models/index.js';
import {
  DocumentType,
  IssueKind,
  PackageStanding,
  PackageStatus,
  ParticularsSpec,
  RegistryOutcome,
  ReportStatus,
  VerificationProfile,
  type FieldRef,
  type PackageId,
} from '../../domain/value-objects/index.js';

import type { $Enums, Prisma } from './generated/client.js';
import { isStoredId, isUuid } from './stored-id.js';
import { VerificationPrismaService } from './verification-prisma.service.js';

// Whether the archive was asked, and whether an approval of what it answered is
// in force: two yes-or-nos, so four combinations, and a standing every one of
// them reaches is one the archive says nothing about.
const EVERY_ARCHIVE_FACT = 4;

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

/*
 * Every field key any shipped profile names as one a case is known by.
 *
 * The union across profiles and not this package's own, because the condition
 * is one statement over a page of rows and a page holds packages of several
 * profiles. It only narrows what is read: which of the values answers for a
 * given row is decided afterwards, by that row's own profile, so a key another
 * profile named and this one did not can never reach a summary.
 *
 * Without it a page of a hundred submissions drags every value the pipeline
 * ever read into memory to print three of them.
 */
const PARTICULAR_FIELD_KEYS = [
  ...new Set(
    VerificationProfile.all.flatMap(profile =>
      profile.particulars.references.map(reference => reference.key.value),
    ),
  ),
];

const SUMMARY_COLUMNS = {
  id: true,
  status: true,
  profileKey: true,
  createdAt: true,
  updatedAt: true,
  // The registry checks are counted and not read: whether the register was
  // asked anything at all is what the standing turns on, and what it answered
  // is the detail view's business. The approvals are counted the same way, and
  // only the ones in force — an approval a later run spent decides nothing
  // (ADR-0016).
  _count: {
    select: {
      sourceFiles: true,
      registryChecks: true,
      archiveSearchApprovals: { where: { supersededAt: null } },
    },
  },
  /*
   * What the register answered, and only that: one enum per question put, so
   * the row can say the answer that decides what happens next. Not the whole
   * check — the address that was asked, the attributes and the papers are the
   * detail view's business, and hauling them onto a page of a hundred rows to
   * print one word would be reading the archive to draw a list.
   */
  registryChecks: { select: { outcome: true } },
  documents: {
    // Two documents of one type is a duplicate the report already states, and
    // the row still has to name the case: the first the package took in
    // answers, which needs the order to be the same on every call.
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      type: true,
      _count: { select: { extractedFields: true } },
      // Only the values some profile names a case by. Which of them this row's
      // profile believes, and off which paper, is worked out below.
      extractedFields: {
        where: { name: { in: PARTICULAR_FIELD_KEYS } },
        select: { name: true, value: true, confidence: true },
      },
    },
  },
  // The register only tallies findings; the whole of each one is the detail
  // view's business.
  report: { select: { status: true, issues: { select: { kind: true } } } },
} as const satisfies Prisma.VerificationPackageSelect;

/*
 * Every approval this package's archive search has had, newest first — spent
 * ones included. A spent approval is what says a person signed for answers the
 * package has since replaced, and leaving it out of the detail view would be
 * exactly the silence ADR-0016 exists to prevent.
 */
const APPROVAL_COLUMNS = {
  orderBy: { approvedAt: 'desc' },
  select: {
    approvedAt: true,
    supersededAt: true,
    summary: true,
    comment: true,
    checks: {
      orderBy: { position: 'asc' },
      select: { key: true, outcome: true },
    },
  },
} as const satisfies Prisma.VerificationPackage$archiveSearchApprovalsArgs;

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
    readonly archiveSearchApprovals: number;
  };
  readonly registryChecks: readonly { readonly outcome: string }[];
  readonly documents: readonly {
    readonly type: string | null;
    readonly _count: { readonly extractedFields: number };
    readonly extractedFields: readonly {
      readonly name: string;
      readonly value: string;
      readonly confidence: number;
    }[];
  }[];
  readonly report: {
    readonly status: string;
    readonly issues: readonly { readonly kind: string }[];
  } | null;
};

type ApprovalRow = {
  readonly approvedAt: Date;
  readonly supersededAt: Date | null;
  readonly summary: string;
  readonly comment: string | null;
  readonly checks: readonly {
    readonly key: string;
    readonly outcome: string;
  }[];
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
        archiveSearchApprovals: APPROVAL_COLUMNS,
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
      archiveSearchApprovals: row.archiveSearchApprovals.map(approval =>
        PackageQueriesAdapter.toApproval(approval),
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
   * The four tallies of a period: how far along the conveyor its submissions
   * are, what the runs made of them, what was found and how often, and how the
   * archive register answered.
   *
   * Four grouped statements and not one, because they count four different
   * things — submissions, reports, findings, questions put to the register —
   * and a single query joining all four would multiply every row by every
   * other. What matters is that there are four of them however many
   * submissions the office has taken in: each is an aggregate the database
   * performs, so nothing here reads a package into memory to add it up.
   *
   * They run in one transaction at `RepeatableRead`, which is the whole point
   * of the operation. Under the default isolation each statement takes its own
   * snapshot, so a run finishing between the first and the second would be
   * counted as under way by one number and as reported on by the next, and the
   * screen would show a summary that does not add up. Read-only work at this
   * level never fails with a serialization error, so the guarantee costs
   * nothing.
   *
   * Every slice is narrowed by the same thing — when the submission was
   * accepted — so all four are about one set of packages (`OverviewPeriod`,
   * ADR-0017).
   */
  async overview(period: OverviewPeriod): Promise<PackagesOverviewView> {
    const accepted = PackageQueriesAdapter.acceptedIn(period);
    const submission = accepted ? { createdAt: accepted } : {};

    const [pipeline, outcomes, findings, archive] =
      await this.prisma.$transaction(
        [
          this.prisma.verificationPackage.groupBy({
            by: ['status'],
            where: submission,
            _count: true,
          }),
          this.prisma.report.groupBy({
            by: ['status'],
            where: accepted ? { package: submission } : {},
            _count: true,
          }),
          // Through the report to the package it is about: a finding belongs to
          // the period its submission was accepted in, never to the moment the
          // report that carries it was last compiled — a re-run would otherwise
          // move findings between periods.
          this.prisma.validationIssue.groupBy({
            by: ['kind'],
            where: accepted ? { report: { package: submission } } : {},
            _count: true,
          }),
          this.prisma.registryCheck.groupBy({
            by: ['outcome'],
            where: accepted ? { package: submission } : {},
            _count: true,
          }),
        ],
        { isolationLevel: 'RepeatableRead' },
      );

    return {
      pipeline: PackageQueriesAdapter.tally(
        PackageStatus.all,
        pipeline.map(row => ({ member: row.status, count: row._count })),
      ),
      outcomes: PackageQueriesAdapter.tally(
        ReportStatus.all,
        outcomes.map(row => ({ member: row.status, count: row._count })),
      ),
      findings: PackageQueriesAdapter.toFindings(
        findings.map(row => ({ kind: row.kind, count: row._count })),
      ),
      archive: PackageQueriesAdapter.tally(
        RegistryOutcome.all,
        archive.map(row => ({ member: row.outcome, count: row._count })),
      ),
    };
  }

  /**
   * The period as a condition over the column it is about — the moment the
   * submission was accepted — or nothing at all where the caller named no
   * bound.
   *
   * Nothing rather than an always-true condition: an empty filter is still a
   * predicate the database has to carry, and three of the four statements
   * carry it across a join.
   */
  private static acceptedIn(
    period: OverviewPeriod,
  ): Prisma.DateTimeFilter | null {
    if (!period.from && !period.to) return null;

    return {
      // Inclusive at the start and exclusive at the end, so two adjacent
      // periods count every submission once and none of them twice.
      ...(period.from ? { gte: period.from } : {}),
      ...(period.to ? { lt: period.to } : {}),
    };
  }

  /**
   * The database's groups as one count per member of a vocabulary.
   *
   * Every member is a key, at zero where the period held none of it: a caller
   * rendering a fixed set of tiles must not lose one because a quiet week held
   * no failures, and "0 failed" is an answer while a missing key is a question.
   *
   * The whole is added up from the groups rather than asked for again — a fifth
   * statement to learn what four already say would be a fifth chance for the
   * numbers to disagree.
   */
  private static tally(
    vocabulary: readonly { readonly value: string }[],
    counted: readonly { readonly member: string; readonly count: number }[],
  ): TallyView {
    const groups = new Map(counted.map(row => [row.member, row.count]));

    return {
      total: counted.reduce((sum, row) => sum + row.count, 0),
      byMember: Object.fromEntries(
        vocabulary.map(member => [member.value, groups.get(member.value) ?? 0]),
      ),
    };
  }

  /**
   * The findings of the period in the two groups the report keeps them in, and
   * never added into one number: what is held against a package, and what is
   * stated for the record beside it. That is the report's own rule and the one
   * a row's `issuesCount` is tallied under — a summary that summed the two
   * would announce faults in submissions that have none.
   */
  private static toFindings(
    counted: readonly FindingCountView[],
  ): FindingsOverviewView {
    const groups = new Map(counted.map(row => [row.kind, row.count]));
    const named = new Set(IssueKind.all.map(kind => kind.value));

    /*
     * Every kind the domain names, whether or not the period held one, and
     * then any stored kind it does not name. `Expired` is such a kind: the
     * column still carries it and the rule no longer does. Counting it — on
     * the side held against the package, which is the call `isAgainstPackage`
     * already makes — is better than dropping it, because a total that
     * silently omits rows is a total nobody can check against the reports.
     */
    const kinds = [
      ...IssueKind.all.map(kind => kind.value),
      ...counted.map(row => row.kind).filter(kind => !named.has(kind)),
    ];

    return {
      againstPackage: PackageQueriesAdapter.toFindingTally(
        kinds.filter(kind => PackageQueriesAdapter.isAgainstPackage(kind)),
        groups,
      ),
      observations: PackageQueriesAdapter.toFindingTally(
        kinds.filter(kind => !PackageQueriesAdapter.isAgainstPackage(kind)),
        groups,
      ),
    };
  }

  /**
   * One group's kinds, most frequent first — the order is what this slice is
   * for. What goes wrong often is a problem in the process; what goes wrong
   * once is a problem in one envelope.
   *
   * A tie keeps the order the domain names the kinds in, which the sort's
   * stability gives for free. Left to chance, two calls over the same data
   * could answer with the same numbers in a different order, and a reader
   * watching a screen would see rows swap places for no reason.
   */
  private static toFindingTally(
    kinds: readonly string[],
    counted: ReadonlyMap<string, number>,
  ): FindingTallyView {
    const byKind: FindingCountView[] = kinds
      .map(kind => ({ kind, count: counted.get(kind) ?? 0 }))
      .sort((one, other) => other.count - one.count);

    return {
      total: byKind.reduce((sum, row) => sum + row.count, 0),
      byKind,
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

    if (criteria.standings.length > 0) {
      // Any of them, because a slice is a set of standings: "in progress" is
      // accepted and being read, and the two must come back as one page that
      // adds up to one count rather than as two lists nobody can page through
      // together.
      conditions.push({
        OR: criteria.standings.map(standing =>
          PackageQueriesAdapter.standingIs(standing),
        ),
      });
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
    /*
     * One branch per (status, report) pair, and inside it the register facts
     * that pair reaches. Without the collapse a standing like Stalled — which
     * every report value and every answer about the archive reaches — would be
     * twenty branches saying what five say.
     *
     * The two archive facts are kept as pairs rather than as a set each,
     * because they do not vary independently: `Cleared` is every combination
     * except a search that was made and not approved, which no product of two
     * sets describes.
     */
    const branches = new Map<
      string,
      { status: string; report: string | null; archive: Set<string> }
    >();

    for (const facts of standing.facts) {
      const report = facts.report?.value ?? null;
      const key = `${facts.status.value}|${report ?? ''}`;
      const branch = branches.get(key) ?? {
        status: facts.status.value,
        report,
        archive: new Set<string>(),
      };

      branch.archive.add(
        `${String(facts.askedTheArchive)}|${String(facts.archiveSearchApproved)}`,
      );
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
        // Every combination reaches this standing, so the archive says nothing
        // about which rows are in it.
        ...(branch.archive.size === EVERY_ARCHIVE_FACT
          ? {}
          : {
              OR: [...branch.archive].map(pair =>
                PackageQueriesAdapter.archiveIs(pair),
              ),
            }),
      })),
    };
  }

  /**
   * One combination of the two things the standing asks about the archive, as
   * a condition over the rows they are read off.
   *
   * Both are relations rather than columns, and both are asked about rather
   * than read: whether the register was asked anything at all, and whether an
   * approval of what it answered is still in force. What it answered, and what
   * the approval said, are the detail view's business.
   */
  private static archiveIs(pair: string): Prisma.VerificationPackageWhereInput {
    const [asked, approved] = pair.split('|').map(flag => flag === 'true');

    return {
      registryChecks: asked ? { some: {} } : { none: {} },
      // An approval a later run spent is not one in force — that is the whole
      // of what `supersededAt` says, and the only thing read off it (ADR-0016).
      archiveSearchApprovals: approved
        ? { some: { supersededAt: null } }
        : { none: { supersededAt: null } },
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

  private static toApproval(row: ApprovalRow): ArchiveSearchApprovalView {
    return {
      approvedAt: row.approvedAt,
      supersededAt: row.supersededAt,
      summary: row.summary,
      comment: row.comment,
      checks: row.checks.map(check => ({
        key: check.key,
        // Only ever written through the domain's own enumeration, so the stored
        // string is one the contract names.
        outcome: check.outcome,
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
    const particulars = PackageQueriesAdapter.particularsOf(row);

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
        archiveSearchApproved: row._count.archiveSearchApprovals > 0,
      }).value,
      profileKey: row.profileKey,
      applicantName: particulars.applicantName,
      propertyAddress: particulars.propertyAddress,
      cadastralNumber: particulars.cadastralNumber,
      // One answer off however many questions the profile put, by the domain's
      // own rule rather than a second copy of it in SQL — the same reason the
      // standing above is worked out here. Null where the register was never
      // asked, which no outcome can say.
      archiveOutcome:
        RegistryOutcome.overall(
          row.registryChecks.map(check => RegistryOutcome.of(check.outcome)),
        )?.value ?? null,
      // The count is already narrowed to the approvals in force, which is the
      // only thing `supersededAt` is ever read for (ADR-0016).
      archiveSearchApproved: row._count.archiveSearchApprovals > 0,
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
   * What this submission is called: the applicant, the address and the parcel,
   * read off the values the pipeline already extracted.
   *
   * The profile decides all of it — which field of which document type each is
   * believed from, and in what order — so the register asks it rather than
   * holding an opinion of its own. Reading the profile off the row's own
   * `profileKey` is what keeps a page of submissions under two profiles
   * answering by each one's rule instead of by the majority's.
   *
   * A profile this build no longer ships is a package that names itself by its
   * id: the register is a read surface, and a stored key nobody recognises must
   * not take a whole page down over three strings nobody can print.
   */
  private static particularsOf(row: SummaryRow): {
    applicantName: StatedValueView | null;
    propertyAddress: StatedValueView | null;
    cadastralNumber: StatedValueView | null;
  } {
    const spec = PackageQueriesAdapter.particularsSpecFor(row.profileKey);
    const stated = (references: readonly FieldRef[]): StatedValueView | null =>
      PackageQueriesAdapter.firstStated(row, references);

    return {
      applicantName: stated(spec.applicantName),
      propertyAddress: stated(spec.propertyAddress),
      cadastralNumber: stated(spec.cadastralNumber),
    };
  }

  private static particularsSpecFor(profileKey: string): ParticularsSpec {
    const profile = VerificationProfile.all.find(
      candidate => candidate.key === profileKey,
    );

    return profile ? profile.particulars : ParticularsSpec.none();
  }

  /**
   * The first of an ordered list of places a value is printed that this package
   * actually states — the same walk the aggregate makes for a registry check's
   * subject, over the rows rather than over the loaded documents.
   *
   * The ordering is the profile's: an address is printed on several of the
   * papers and they are not equally trustworthy (ADR-0010). Where two documents
   * answer to one type, the first the package took in answers, which is why the
   * documents are read in a fixed order.
   */
  private static firstStated(
    row: SummaryRow,
    references: readonly FieldRef[],
  ): StatedValueView | null {
    for (const reference of references) {
      for (const document of row.documents) {
        if (document.type !== reference.type.value) continue;

        const field = document.extractedFields.find(
          candidate => candidate.name === reference.key.value,
        );

        if (field) {
          return { value: field.value, confidence: field.confidence };
        }
      }
    }

    return null;
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
