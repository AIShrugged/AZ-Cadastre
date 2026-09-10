import { describe, expect, it } from 'vitest';

import type {
  DocumentAttestationView,
  PackagesOverviewView,
  PackageSummaryView,
} from '../../application/read-models/index.js';
import {
  IssueKind,
  PackageId,
  PackageStatus,
  RegistryOutcome,
  ReportStatus,
} from '../../domain/value-objects/index.js';

import { PackageQueriesAdapter } from './package-queries.adapter.js';
import type { VerificationPrismaService } from './verification-prisma.service.js';

const PACKAGE_ID = '0190a1b2-c3d4-7e5f-8a9b-000000000001';

type Row = Record<string, unknown>;

type RowOptions = {
  // Where the pipeline got to, and what the run made of the package. Defaulted
  // to a finished run so a spec about the tally need not say either.
  readonly status?: string;
  readonly reportStatus?: string;
  // How many of the profile's questions the register was actually asked.
  readonly registryChecks?: number;
  // What it answered to each of them, in the order it was asked. An empty list
  // is a register nobody put a question to.
  readonly registryOutcomes?: readonly string[];
  // Approvals of the archive search still in force. At most one ever is.
  readonly approvalsInForce?: number;
  // Which profile decides what this package is called. A key the build no
  // longer ships is one of the cases under test.
  readonly profileKey?: string;
  // The documents the pipeline read out of the files, with the values it
  // extracted off each — as the register selects them, narrowed to the keys a
  // profile names a case by.
  readonly documents?: readonly Row[];
};

/** One document as the register reads it: what it was classified as, and the
 *  values a profile might name the case by. */
function aDocument(
  type: string | null,
  fields: Readonly<Record<string, string>> = {},
  confidence = 0.9,
): Row {
  const extractedFields = Object.entries(fields).map(([name, value]) => ({
    name,
    value,
    confidence,
  }));

  return {
    type,
    _count: { extractedFields: extractedFields.length },
    extractedFields,
  };
}

/** The one row the register reads, with the report's findings written as the
 *  kinds alone — the tally is all this adapter does with them. */
function aRow(kinds: readonly string[] | null, options: RowOptions = {}): Row {
  return {
    id: PACKAGE_ID,
    status: options.status ?? 'Completed',
    profileKey: options.profileKey ?? 'cadastre',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    _count: {
      sourceFiles: 1,
      registryChecks:
        options.registryChecks ?? options.registryOutcomes?.length ?? 0,
      archiveSearchApprovals: options.approvalsInForce ?? 0,
    },
    registryChecks: (options.registryOutcomes ?? []).map(outcome => ({
      outcome,
    })),
    documents: options.documents ?? [],
    report:
      kinds === null
        ? null
        : {
            status: options.reportStatus ?? 'IssuesFound',
            issues: kinds.map(kind => ({ kind })),
          },
  };
}

/** Prisma stands in at the boundary: the adapter is asked for the register's
 *  row, and what it counts off the one it is given is the whole subject. Which
 *  rows a search or a filter matches is not — that is a question only a
 *  database can answer, and it is put to one in the integration set. */
function adapterOver(rows: readonly Row[]): PackageQueriesAdapter {
  const prisma = {
    verificationPackage: {
      findMany: () => Promise.resolve(rows),
      findUnique: () => Promise.resolve(rows[0] ?? null),
      count: () => Promise.resolve(rows.length),
    },
    $transaction: (operations: readonly Promise<unknown>[]) =>
      Promise.all(operations),
  } as unknown as VerificationPrismaService;

  return new PackageQueriesAdapter(prisma);
}

// Narrowed by nothing: these specs are about what the register makes of a row,
// not about which rows it is handed.
const EVERYTHING = {
  search: null,
  standings: [],
  reportStatus: null,
  limit: 20,
  offset: 0,
} as const;

async function summariesOf(
  rows: readonly Row[],
): Promise<readonly PackageSummaryView[]> {
  return (await adapterOver(rows).listSummaries(EVERYTHING)).items;
}

// ─── the summary of a period ─────────────────────────────────────────────────

type GroupedRows = {
  readonly packages?: readonly Row[];
  readonly reports?: readonly Row[];
  readonly findings?: readonly Row[];
  readonly archive?: readonly Row[];
};

/** One group as the database answers it: the value, and how many rows had it. */
const group = (column: string, value: string, count: number): Row => ({
  [column]: value,
  _count: count,
});

type OverviewSubject = {
  readonly adapter: PackageQueriesAdapter;
  // What each of the four statements was narrowed by, so a spec can hold the
  // period against the condition it actually became.
  readonly narrowedBy: Record<string, unknown>;
  readonly transaction: { count: number; isolationLevel?: string };
};

/**
 * Prisma stands in at the boundary again, and this time it offers **only**
 * `groupBy`. Reading rows to fold them in the application is the failure this
 * operation exists to avoid — the list of submissions only grows — so the
 * double refuses to hand any over: an implementation that tried would fail
 * here rather than pass slowly in production.
 */
function overviewOver(grouped: GroupedRows = {}): OverviewSubject {
  const narrowedBy: Record<string, unknown> = {};
  const transaction: { count: number; isolationLevel?: string } = { count: 0 };

  const model = (name: string, rows: readonly Row[] = []) => ({
    groupBy: (args: { where: unknown }) => {
      narrowedBy[name] = args.where;
      return Promise.resolve(rows);
    },
    findMany: () => {
      throw new Error(`${name} was read row by row rather than counted`);
    },
  });

  const prisma = {
    verificationPackage: model('packages', grouped.packages),
    report: model('reports', grouped.reports),
    validationIssue: model('findings', grouped.findings),
    registryCheck: model('archive', grouped.archive),
    $transaction: (
      operations: readonly Promise<unknown>[],
      options?: { isolationLevel?: string },
    ) => {
      transaction.count += 1;
      transaction.isolationLevel = options?.isolationLevel;
      return Promise.all(operations);
    },
  } as unknown as VerificationPrismaService;

  return {
    adapter: new PackageQueriesAdapter(prisma),
    narrowedBy,
    transaction,
  };
}

// Every submission the office has ever taken in.
const ALL_TIME = { from: null, to: null } as const;

async function overviewOf(grouped: GroupedRows): Promise<PackagesOverviewView> {
  return overviewOver(grouped).adapter.overview(ALL_TIME);
}

// ─── what the detail says about the marks on a paper ─────────────────────────

const FILE_ID = '0190a1b2-c3d4-7e5f-8a9b-000000000010';
const DOCUMENT_ID = '0190a1b2-c3d4-7e5f-8a9b-000000000011';

/** One sheet as the register selects it: what was read off it, or nothing at
 *  all where the reader never got to it. */
function aSheet(
  pageNumber: number,
  text: string | null,
  confidence = 0.9,
): Row {
  return {
    pageNumber,
    imageStorageKey: `pkg/page_00${pageNumber}.png`,
    ocr: text === null ? null : { text, confidence },
  };
}

function aPlacedDocument(
  type: string | null,
  firstPage = 1,
  lastPage = 1,
): Row {
  return {
    id: DOCUMENT_ID,
    firstPage,
    lastPage,
    type,
    classificationConfidence: type === null ? null : 0.94,
    extractedFields: [],
  };
}

/** The one row `findDetail` reads, with a single file holding the sheets and
 *  the documents a spec is about. */
function aDetailRow(
  documents: readonly Row[],
  pages: readonly Row[],
  profileKey = 'cadastre',
): Row {
  return {
    ...aRow([], { profileKey }),
    crossChecks: [],
    archiveSearchApprovals: [],
    sourceFiles: [
      {
        id: FILE_ID,
        originalFilename: 'submission.pdf',
        contentType: 'application/pdf',
        pages,
        documents,
      },
    ],
  };
}

async function attestationsOf(
  row: Row,
): Promise<readonly (DocumentAttestationView | null)[]> {
  const detail = await adapterOver([row]).findDetail(PackageId.of(PACKAGE_ID));

  return (detail?.files[0]?.documents ?? []).map(
    document => document.attestation,
  );
}

describe('PackageQueriesAdapter', () => {
  describe('the register tally', () => {
    it('counts a shortfall in the package and an unsure reading apart', async () => {
      const [summary] = await summariesOf([
        aRow(['MissingDocument', 'FieldMismatch', 'LowConfidence']),
      ]);

      expect(summary?.issuesCount).toBe(2);
      expect(summary?.lowConfidenceCount).toBe(1);
    });

    // The register said 17 замечаний over a package whose card showed 19: the
    // row was counting the eight service sheets, the three second extracts and
    // the silent archive as findings, and leaving out the fourteen readings the
    // engine was unsure of. Both screens now count by the domain's rule.
    it('leaves the observations out of both counts', async () => {
      const [summary] = await summariesOf([
        aRow([
          ...Array.from({ length: 8 }, () => 'ExtraDocument'),
          ...Array.from({ length: 3 }, () => 'DuplicateDocument'),
          'RegistryUnconfirmed',
          ...Array.from({ length: 14 }, () => 'LowConfidence'),
          ...Array.from({ length: 3 }, () => 'MissingDocument'),
          'FieldMismatch',
          'FieldMismatch',
        ]),
      ]);

      expect(summary?.issuesCount).toBe(5);
      expect(summary?.lowConfidenceCount).toBe(14);
      // What the package's card puts at the head of its worklist.
      expect(
        (summary?.issuesCount ?? 0) + (summary?.lowConfidenceCount ?? 0),
      ).toBe(19);
    });

    it('reports a package carrying nothing but observations as clean', async () => {
      const [summary] = await summariesOf([
        aRow(['ExtraDocument', 'DuplicateDocument', 'RegistryUnconfirmed']),
      ]);

      expect(summary?.issuesCount).toBe(0);
      expect(summary?.lowConfidenceCount).toBe(0);
    });

    // The archive answers have their own surface on the card, but they are
    // findings against the package all the same, and the register has only the
    // one column to say so in.
    it('counts what the archive disagreed with', async () => {
      const [summary] = await summariesOf([
        aRow(['RegistryMismatch', 'RegistryDocumentMissing']),
      ]);

      expect(summary?.issuesCount).toBe(2);
    });

    // A read surface must not be taken down by one row it cannot place: an
    // unrecognised kind is counted rather than thrown on.
    it('counts a kind the enumeration does not know', async () => {
      const [summary] = await summariesOf([
        aRow(['SomethingThisBuildHasNeverHeardOf']),
      ]);

      expect(summary?.issuesCount).toBe(1);
    });

    it('counts nothing before the run has compiled a report', async () => {
      const [summary] = await summariesOf([aRow(null)]);

      expect(summary?.reportStatus).toBeNull();
      expect(summary?.issuesCount).toBe(0);
      expect(summary?.lowConfidenceCount).toBe(0);
    });

    // The row and the card are read off the same mapping, which is what stops
    // them drifting apart again.
    it('tallies a single summary the same way as the list', async () => {
      const kinds = ['ExtraDocument', 'MissingDocument', 'LowConfidence'];
      const summary = await adapterOver([aRow(kinds)]).findSummary(
        PackageId.of(PACKAGE_ID),
      );

      expect(summary?.issuesCount).toBe(1);
      expect(summary?.lowConfidenceCount).toBe(1);
    });
  });

  /*
   * The register does not store where a submission stands; it reads it off the
   * same row it tallies, through the domain's own rule. These cover the wiring
   * — that the right three columns reach that rule — and not the rule itself,
   * which is covered where it lives (ADR-0014).
   */
  describe('where the row says a submission stands', () => {
    it('says a run is reading it', async () => {
      const [summary] = await summariesOf([
        aRow(null, { status: 'Processing' }),
      ]);

      expect(summary?.standing).toBe('UnderVerification');
    });

    it('says a required paper never arrived', async () => {
      const [summary] = await summariesOf([
        aRow(['MissingDocument'], { reportStatus: 'IncompletePackage' }),
      ]);

      expect(summary?.standing).toBe('ShortOfDocuments');
    });

    it('holds a clean package for the approval of the archive search it rests on', async () => {
      const [summary] = await summariesOf([
        aRow([], { reportStatus: 'OK', registryChecks: 1 }),
      ]);

      expect(summary?.standing).toBe('AwaitingArchiveApproval');
    });

    it('clears a clean package the register was never asked about', async () => {
      const [summary] = await summariesOf([
        aRow([], { reportStatus: 'OK', registryChecks: 0 }),
      ]);

      expect(summary?.standing).toBe('Cleared');
    });

    // The row and the card are read off the same mapping, for the same reason
    // the tally above is.
    it('says the same of a single summary as of the list', async () => {
      const summary = await adapterOver([
        aRow(['MissingDocument'], { reportStatus: 'IncompletePackage' }),
      ]).findSummary(PackageId.of(PACKAGE_ID));

      expect(summary?.standing).toBe('ShortOfDocuments');
    });
  });

  /*
   * What the row calls the case. Nothing is stored: the register walks the
   * profile's ordering over the values the pipeline already extracted, which is
   * the same walk the aggregate makes for a registry check's subject. What is
   * under test is that walk — which paper answers, which value wins when
   * several could, and what a row says when none does.
   */
  describe('what the row calls the case', () => {
    it('names the case off the papers, with the confidence each value was read at', async () => {
      const [summary] = await summariesOf([
        aRow([], {
          documents: [
            aDocument(
              'application',
              {
                applicant_name: 'ELÇİN ƏLİYEV',
                property_address: 'Azadlıq pr. 12, mən. 43',
                cadastral_number: 'AZ-CAD-9999-000',
              },
              0.92,
            ),
          ],
        }),
      ]);

      expect(summary?.applicantName).toEqual({
        value: 'ELÇİN ƏLİYEV',
        confidence: 0.92,
      });
      expect(summary?.propertyAddress).toEqual({
        value: 'Azadlıq pr. 12, mən. 43',
        confidence: 0.92,
      });
    });

    /*
     * The profile believes the surveyed drawing over the form filled in by
     * hand, and the register obeys it rather than taking whichever value the
     * database handed over first — which is the whole reason the ordering is
     * declared (ADR-0010).
     */
    it('believes the paper the profile believes, not the row the database offered first', async () => {
      const [summary] = await summariesOf([
        aRow([], {
          documents: [
            aDocument('application', {
              property_address: 'Xetan uue, Burome 98. 5-862 saha',
              cadastral_number: 'AZ-CAD-0000-999',
            }),
            aDocument('land_plot_plan', {
              property_address: 'Bakı ş., Nəsimi r., Azadlıq pr. 12',
              cadastral_number: 'AZ-CAD-1024-311',
            }),
          ],
        }),
      ]);

      expect(summary?.propertyAddress?.value).toBe(
        'Bakı ş., Nəsimi r., Azadlıq pr. 12',
      );
      expect(summary?.cadastralNumber?.value).toBe('AZ-CAD-1024-311');
    });

    // The next paper down is what a case is called while the one above it is
    // still unread — a row nobody can name is a row nobody can find.
    it('falls through to the next paper the profile names when the first states nothing', async () => {
      const [summary] = await summariesOf([
        aRow([], {
          documents: [
            aDocument('land_plot_plan', {}),
            aDocument('sketch_project', {
              property_address: 'Bakı ş., Nəsimi r., Azadlıq pr. 12',
            }),
          ],
        }),
      ]);

      expect(summary?.propertyAddress?.value).toBe(
        'Bakı ş., Nəsimi r., Azadlıq pr. 12',
      );
    });

    // Two papers of one type is a duplicate the report already states; the row
    // still has to say one name, and it says the first the package took in.
    it('takes the first of two documents answering to one type', async () => {
      const [summary] = await summariesOf([
        aRow([], {
          documents: [
            aDocument('application', { applicant_name: 'ELÇİN ƏLİYEV' }),
            aDocument('application', { applicant_name: 'RÜBABƏ ƏLİYEVA' }),
          ],
        }),
      ]);

      expect(summary?.applicantName?.value).toBe('ELÇİN ƏLİYEV');
    });

    it('says nothing about a package whose papers have not been read yet', async () => {
      const [summary] = await summariesOf([aRow(null, { status: 'Pending' })]);

      expect(summary?.applicantName).toBeNull();
      expect(summary?.propertyAddress).toBeNull();
      expect(summary?.cadastralNumber).toBeNull();
    });

    // A document the classifier could not place carries no type, so no ordering
    // reaches it: whatever was read off it names nothing.
    it('names nothing off a document that was never placed', async () => {
      const [summary] = await summariesOf([
        aRow([], {
          documents: [aDocument(null, { applicant_name: 'ELÇİN ƏLİYEV' })],
        }),
      ]);

      expect(summary?.applicantName).toBeNull();
    });

    /*
     * A stored profile key this build no longer ships. The register is a read
     * surface: one such row must leave the case unnamed, never take the page
     * down (the same rule an unrecognised finding kind is counted under).
     */
    it('leaves a package of a profile it no longer ships unnamed rather than failing', async () => {
      const [summary] = await summariesOf([
        aRow([], {
          profileKey: 'mortgage',
          documents: [
            aDocument('application', { applicant_name: 'ELÇİN ƏLİYEV' }),
          ],
        }),
      ]);

      expect(summary?.applicantName).toBeNull();
      expect(summary?.id).toBe(PACKAGE_ID);
    });
  });

  /*
   * What the archive answered, as the one word a row can carry. Which answer
   * that is when the profile put several questions is the domain's rule; what
   * is covered here is that the register reaches it with what the register
   * checks actually said, and that a package nobody asked about says nothing.
   */
  describe('what the row says the archive answered', () => {
    it('says nothing about a package the register was never asked about', async () => {
      const [summary] = await summariesOf([aRow([], { reportStatus: 'OK' })]);

      expect(summary?.archiveOutcome).toBeNull();
      expect(summary?.archiveSearchApproved).toBe(false);
    });

    it('carries the answer of the one question that was put', async () => {
      const [summary] = await summariesOf([
        aRow([], { registryOutcomes: ['Confirmed'] }),
      ]);

      expect(summary?.archiveOutcome).toBe('Confirmed');
    });

    // Several questions, one row: the answer that decides what happens next,
    // never the first one the database handed over.
    it('answers with what most needs the inspector when several questions were put', async () => {
      const [summary] = await summariesOf([
        aRow([], { registryOutcomes: ['Confirmed', 'Differs', 'NotFound'] }),
      ]);

      expect(summary?.archiveOutcome).toBe('Differs');
    });

    it('says a signature is in force only while it stands', async () => {
      const [signed] = await summariesOf([
        aRow([], { registryOutcomes: ['Confirmed'], approvalsInForce: 1 }),
      ]);
      const [spent] = await summariesOf([
        aRow([], { registryOutcomes: ['Confirmed'], approvalsInForce: 0 }),
      ]);

      expect(signed?.archiveSearchApproved).toBe(true);
      expect(spent?.archiveSearchApproved).toBe(false);
    });
  });

  /*
   * What the sheets say about the seal and the signature, worked out here from
   * the transcription the query already holds. The rule is the domain's own
   * (`attestationOf`) and is not restated: what a spec here is about is that
   * the right sheets and the right expectation reach it (COMM-76).
   */
  describe('what the detail says about the marks on a paper', () => {
    it('shows the seal an office pressed, and not only the one it did not', async () => {
      const [attestation] = await attestationsOf(
        aDetailRow(
          [aPlacedDocument('archive_certificate')],
          [
            aSheet(
              1,
              'ARXİV ARAYIŞI\n[stamp: BAKI ŞƏHƏR DÖVLƏT ARXİVİ]\n[signature]',
            ),
          ],
        ),
      );

      expect(attestation?.stamp).toEqual({
        expected: true,
        state: 'Present',
        legends: ['BAKI ŞƏHƏR DÖVLƏT ARXİVİ'],
        confidence: 0.9,
      });
      expect(attestation?.signature.state).toBe('Present');
    });

    // The file's sheets, narrowed to the document's own: a seal on the paper
    // that follows is not this paper's seal.
    it('reads only the sheets the document occupies', async () => {
      const attestations = await attestationsOf(
        aDetailRow(
          [
            { ...aPlacedDocument('archive_certificate', 1, 1) },
            {
              ...aPlacedDocument('disposal_order', 2, 2),
              id: '0190a1b2-c3d4-7e5f-8a9b-000000000012',
            },
          ],
          [
            aSheet(1, 'ARXİV ARAYIŞI'),
            aSheet(2, 'SƏRƏNCAM\n[stamp: İCRA HAKİMİYYƏTİ]\n[signature]'),
          ],
        ),
      );

      expect(attestations[0]?.stamp.state).toBe('Absent');
      expect(attestations[1]?.stamp.legends).toEqual(['İCRA HAKİMİYYƏTİ']);
    });

    // Without a type there is no specification, and so no answer about what the
    // paper was expected to carry.
    it('says nothing about a document the profile has not placed', async () => {
      const unclassified = await attestationsOf(
        aDetailRow([aPlacedDocument(null)], [aSheet(1, 'ARXİV ARAYIŞI')]),
      );
      const extra = await attestationsOf(
        aDetailRow(
          [aPlacedDocument('out_of_profile')],
          [aSheet(1, 'QAİMƏ\n[stamp: KURYER]')],
        ),
      );

      expect(unclassified[0]).toBeNull();
      expect(extra[0]).toBeNull();
    });

    // Expectation and observation are independent: a receipt no office seals
    // still answers about what is printed on it.
    it('answers for a paper the profile expects no mark of', async () => {
      const [attestation] = await attestationsOf(
        aDetailRow(
          [aPlacedDocument('payment_receipt')],
          [aSheet(1, 'ÖDƏNİŞ QƏBZİ\nQəbz No: QB-2025-88301')],
        ),
      );

      expect(attestation?.stamp.expected).toBe(false);
      expect(attestation?.signature.expected).toBe(false);
      expect(attestation?.stamp.state).toBe('Absent');
    });

    it('says the marks were never looked at on a sheet nobody read', async () => {
      const [attestation] = await attestationsOf(
        aDetailRow([aPlacedDocument('archive_certificate')], [aSheet(1, null)]),
      );

      expect(attestation?.stamp).toEqual({
        expected: true,
        state: 'Unread',
        legends: [],
        confidence: null,
      });
    });

    // A profile this build no longer ships expects nothing of the paper — and
    // the register is a read surface, so a stored key nobody recognises must
    // not take the detail down over it.
    it('still says what was seen under a profile the build no longer ships', async () => {
      const [attestation] = await attestationsOf(
        aDetailRow(
          [aPlacedDocument('archive_certificate')],
          [aSheet(1, 'ARXİV ARAYIŞI\n[stamp: ARXİV]')],
          'retired-profile',
        ),
      );

      expect(attestation?.stamp.expected).toBe(false);
      expect(attestation?.stamp.state).toBe('Present');
    });
  });

  /*
   * The summary of a period. What it counts is counted by the database — the
   * double above will not hand a row over — so what is left to a spec here is
   * what the register makes of the four groups it gets back, and what it asks
   * for in the first place.
   */
  describe('the summary of a period', () => {
    it('keeps what is held against a package apart from what is noted beside it', async () => {
      // arrange — three shortfalls, and four observations that are not
      // arrange   findings against anything
      const overview = await overviewOf({
        findings: [
          group('kind', 'MissingDocument', 2),
          group('kind', 'FieldMismatch', 1),
          group('kind', 'ExtraDocument', 3),
          group('kind', 'RegistryUnconfirmed', 1),
        ],
      });

      // assert — never one number over the two: a report carrying nothing but
      // observations still reads OK
      expect(overview.findings.againstPackage.total).toBe(3);
      expect(overview.findings.observations.total).toBe(4);
    });

    it('counts an unsure reading against the package, and a paper the applicant still owes as neither', async () => {
      // act
      const overview = await overviewOf({
        findings: [
          group('kind', 'LowConfidence', 5),
          group('kind', 'SupportingDocumentsRequired', 9),
        ],
      });

      // assert
      expect(overview.findings.againstPackage.total).toBe(5);
      expect(overview.findings.observations.total).toBe(9);
    });

    // Which is the whole question this slice answers: what goes wrong often is
    // a problem in the process, what goes wrong once is a problem in one
    // envelope.
    it('puts the most frequent finding first', async () => {
      // act
      const overview = await overviewOf({
        findings: [
          group('kind', 'MissingDocument', 2),
          group('kind', 'FieldMismatch', 11),
          group('kind', 'RegistryMismatch', 7),
        ],
      });

      // assert
      expect(
        overview.findings.againstPackage.byKind
          .filter(row => row.count > 0)
          .map(row => row.kind),
      ).toEqual(['FieldMismatch', 'RegistryMismatch', 'MissingDocument']);
    });

    // A screen that re-reads this every minute must not shuffle rows that are
    // level with each other, so a tie keeps the order the domain names them in.
    it('settles a tie the same way every time', async () => {
      // arrange
      const findings = [
        group('kind', 'FieldMismatch', 4),
        group('kind', 'MissingDocument', 4),
      ];

      // act
      const [first, second] = await Promise.all([
        overviewOf({ findings }),
        overviewOf({ findings: [...findings].reverse() }),
      ]);

      // assert
      const kinds = (overview: PackagesOverviewView) =>
        overview.findings.againstPackage.byKind
          .filter(row => row.count > 0)
          .map(row => row.kind);
      expect(kinds(first)).toEqual(['MissingDocument', 'FieldMismatch']);
      expect(kinds(second)).toEqual(kinds(first));
    });

    // A tile that vanishes on a quiet week is a tile a reader cannot trust to
    // be there — and "0 failed" is an answer, while a missing key is a question.
    it('names every state, outcome and kind the domain has, at zero', async () => {
      // act
      const overview = await overviewOf({});

      // assert
      expect(Object.keys(overview.pipeline.byMember).sort()).toEqual(
        PackageStatus.all.map(status => status.value).sort(),
      );
      expect(Object.keys(overview.outcomes.byMember).sort()).toEqual(
        ReportStatus.all.map(status => status.value).sort(),
      );
      expect(Object.keys(overview.archive.byMember).sort()).toEqual(
        RegistryOutcome.all.map(outcome => outcome.value).sort(),
      );
      expect(
        [
          ...overview.findings.againstPackage.byKind,
          ...overview.findings.observations.byKind,
        ]
          .map(row => row.kind)
          .sort(),
      ).toEqual(IssueKind.all.map(kind => kind.value).sort());
      expect(Object.values(overview.pipeline.byMember)).toEqual([0, 0, 0, 0]);
    });

    /*
     * The register's coverage is partial and historical, so its silence about a
     * property is an absence of evidence and not a disagreement with the papers
     * (ADR-0009). One number over both would report a gap in the archive as a
     * fault in the submissions.
     */
    it('keeps a register that found nothing apart from one that disagreed', async () => {
      // act
      const overview = await overviewOf({
        archive: [
          group('outcome', 'NotFound', 12),
          group('outcome', 'Differs', 2),
          group('outcome', 'Confirmed', 6),
        ],
      });

      // assert
      expect(overview.archive.byMember).toMatchObject({
        NotFound: 12,
        Differs: 2,
        Confirmed: 6,
        Incomplete: 0,
        Ambiguous: 0,
      });
      expect(overview.archive.total).toBe(20);
    });

    it('adds the whole up out of the groups the database answered with', async () => {
      // act
      const overview = await overviewOf({
        packages: [
          group('status', 'Completed', 40),
          group('status', 'Failed', 2),
        ],
        reports: [group('status', 'OK', 30), group('status', 'IssuesFound', 8)],
      });

      // assert — the outcomes are fewer than the submissions, and deliberately:
      // one still being read has no report to have an outcome in
      expect(overview.pipeline.total).toBe(42);
      expect(overview.outcomes.total).toBe(38);
      expect(overview.outcomes.byMember).toMatchObject({
        OK: 30,
        IssuesFound: 8,
        IncompletePackage: 0,
      });
    });

    // A read surface must not be taken down, or made to lie, by one row it
    // cannot place. `Expired` is such a row: the column still carries it and
    // the rule no longer does.
    it('counts a stored kind the enumeration no longer names', async () => {
      // act
      const overview = await overviewOf({
        findings: [
          group('kind', 'Expired', 3),
          group('kind', 'MissingDocument', 1),
        ],
      });

      // assert — counted, and on the side that is held against the package
      expect(overview.findings.againstPackage.total).toBe(4);
      expect(overview.findings.againstPackage.byKind).toContainEqual({
        kind: 'Expired',
        count: 3,
      });
      expect(overview.findings.observations.total).toBe(0);
    });

    /*
     * The reason there is one operation rather than four calls. Under the
     * default isolation each statement takes its own snapshot, so a run
     * finishing between two of them is counted as under way by one number and
     * as reported on by the next — and the screen shows a summary that does not
     * add up.
     */
    it('takes all four counts in one transaction, at one instant', async () => {
      // arrange
      const subject = overviewOver({});

      // act
      await subject.adapter.overview(ALL_TIME);

      // assert
      expect(subject.transaction.count).toBe(1);
      expect(subject.transaction.isolationLevel).toBe('RepeatableRead');
    });

    describe('the period', () => {
      /*
       * Every slice narrowed by the same thing — when the submission was
       * accepted — and never by four timestamps of its own, or the four numbers
       * would be about four different sets of packages. The findings reach it
       * through the report, so that a re-run does not move a finding from one
       * period to another.
       */
      it('narrows every count by when the submission was accepted', async () => {
        // arrange
        const subject = overviewOver({});
        const from = new Date('2026-08-01T00:00:00.000Z');
        const to = new Date('2026-09-01T00:00:00.000Z');

        // act
        await subject.adapter.overview({ from, to });

        // assert — inclusive at the start, exclusive at the end, so two
        // adjacent months count every submission once and none of them twice
        const accepted = { createdAt: { gte: from, lt: to } };
        expect(subject.narrowedBy.packages).toEqual(accepted);
        expect(subject.narrowedBy.reports).toEqual({ package: accepted });
        expect(subject.narrowedBy.archive).toEqual({ package: accepted });
        expect(subject.narrowedBy.findings).toEqual({
          report: { package: accepted },
        });
      });

      it('takes an open end as open rather than as now', async () => {
        // arrange
        const subject = overviewOver({});
        const from = new Date('2026-08-01T00:00:00.000Z');

        // act
        await subject.adapter.overview({ from, to: null });

        // assert
        expect(subject.narrowedBy.packages).toEqual({
          createdAt: { gte: from },
        });
      });

      // A period nobody named is not an always-true predicate the database has
      // to carry into three joins.
      it('asks for no condition at all when no bound was named', async () => {
        // arrange
        const subject = overviewOver({});

        // act
        await subject.adapter.overview(ALL_TIME);

        // assert
        expect(subject.narrowedBy.packages).toEqual({});
        expect(subject.narrowedBy.reports).toEqual({});
        expect(subject.narrowedBy.findings).toEqual({});
        expect(subject.narrowedBy.archive).toEqual({});
      });
    });
  });
});
