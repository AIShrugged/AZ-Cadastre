/**
 * The checklist beside the case — what the package carries, what its provision
 * of Article 8 asks for, how the papers agreed with each other and how the
 * archive answered — as rows a rail can draw and a jump can follow.
 *
 * Every mark is read off an answer the server already published: the gaps, the
 * provision, the cross-document checks, the register's answers. Nothing here
 * works out whether a paper is missing or a check failed; it only groups what
 * was said and names each row by the one word it is drawn in. The rail is an
 * index into the evidence below it, never a second account of it.
 */
import {
  isSuperseded,
  OUTCOME_KEY,
  requiredShortfall,
  speaksAgainst,
} from '@/entities/verification-package';
import { translateOr } from '@/shared/i18n';
import type {
  CaseProvisionDto,
  CrossCheckDto,
  CrossCheckVerdict,
  DocumentDto,
  DocumentGapDto,
  IssueDto,
  PackageDetailDto,
  ProvisionRequirementDto,
  RegistryCheckDto,
} from '@cadastre/api-contracts/verification';

/** The `t` from `useI18n`. */
type Translate = (
  key: string,
  vars?: Record<string, string | number>,
) => string;

/**
 * How a row is drawn. Five and not three, because the rail says five different
 * things and a reader has to tell them apart at a glance:
 *
 * - `ok` — in the package, agreed, confirmed.
 * - `short` — a paper the package does not carry.
 * - `against` — something on record speaks against the papers: two documents
 *   disagree, the archive's record differs, a title is dated outside its window.
 * - `open` — not settled either way: a check that could not decide, a
 *   requirement that turns on a year nobody read.
 * - `quiet` — neither a fault nor a pass: the archive holds no record, a paper
 *   the policy takes from a state system that is not connected. Drawing these
 *   as shortfalls would state a finding the report never made (ADR-0009).
 */
export type CheckMark = 'ok' | 'short' | 'against' | 'open' | 'quiet';

export type ChecklistRow = {
  key: string;
  label: string;
  mark: CheckMark;
  /** The word the mark stands for — printed under a row that is not `ok`, and
   *  said to a screen reader on every row. */
  state: string;
  /** Where the evidence is. Null where there is nothing on the page to open. */
  anchor: string | null;
  docId: string | null;
};

/** The paper in force that answers any of these types — a replaced scan is the
 *  record of what was sent first, not the paper the case rests on (COMM-80). */
function documentOf(
  documents: readonly DocumentDto[],
  types: readonly string[],
): DocumentDto | undefined {
  return documents.find(
    doc => !isSuperseded(doc) && doc.type !== null && types.includes(doc.type),
  );
}

function paperRow(
  t: Translate,
  types: readonly string[],
  answered: boolean,
  documents: readonly DocumentDto[],
): ChecklistRow {
  const doc = answered ? documentOf(documents, types) : undefined;

  return {
    key: types.join('|'),
    label: types
      .map(type => translateOr(t, `doctype.${type}`, type))
      .join(` ${t('common.or')} `),
    mark: answered ? 'ok' : 'short',
    state: t(answered ? 'sheet.doc.present' : 'sheet.doc.missing'),
    // A paper that is here opens on itself; one that is not opens on the row
    // that takes a file for it, which is the move the inspector has.
    anchor: doc ? `#doc-${doc.id}` : answered ? null : '#document-gaps',
    docId: doc?.id ?? null,
  };
}

/**
 * Every paper the package must carry: the profile's own list, then whatever the
 * decided provision adds to it.
 *
 * The profile names two papers of every package whatever its case (Articles
 * 10.2.2 and 10.2.3); the rest turns on the provision (ADR-0025). Until the
 * provision is decided only the profile's list is stated — listing a
 * candidate's papers would tell the inspector a package is short of a permit
 * its case may never need.
 *
 * Which of the profile's papers are missing is the server's gap list and never
 * a tally made here (COMM-80).
 */
export function completenessRows(
  t: Translate,
  {
    required,
    gaps,
    provision,
    documents,
  }: {
    required: readonly string[];
    gaps: readonly DocumentGapDto[];
    provision: CaseProvisionDto | null;
    documents: readonly DocumentDto[];
  },
): ChecklistRow[] {
  const short = new Set(requiredShortfall(required, gaps));
  const rows = required.map(type =>
    paperRow(t, [type], !short.has(type), documents),
  );

  if (provision?.outcome !== 'Determined') return rows;

  const listed = new Set(required);
  for (const requirement of provision.provisions[0]?.requirements ?? []) {
    // A group the policy does not ask of this package — confirmed through a
    // state system instead, or turning on a year nobody read — is not a paper
    // the package is short of. The provision's own block says which it is.
    if (requirement.applies !== true) continue;
    if (requirement.anyOf.every(type => listed.has(type))) continue;
    rows.push(paperRow(t, requirement.anyOf, requirement.answered, documents));
  }

  return rows;
}

function requirementRow(
  t: Translate,
  requirement: ProvisionRequirementDto,
  documents: readonly DocumentDto[],
): ChecklistRow {
  const row = paperRow(t, requirement.anyOf, requirement.answered, documents);

  if (requirement.applies === false) {
    return {
      ...row,
      mark: 'quiet',
      state: t('rail.via_integration'),
      anchor: '#provision',
      docId: null,
    };
  }
  if (requirement.applies === null) {
    return {
      ...row,
      mark: 'open',
      state: t('rail.year_unknown'),
      anchor: '#provision',
      docId: null,
    };
  }

  return row;
}

/**
 * What the provision asks for, as the provision states it: the title to the
 * land every provision asks for, and — once one provision is decided — each
 * group of papers it adds.
 *
 * The title row is more than present-or-not. A title dated outside the window
 * its item gives it does not found the case, so "in the package" is not the
 * whole answer (ADR-0025).
 */
export function provisionRows(
  t: Translate,
  provision: CaseProvisionDto,
  documents: readonly DocumentDto[],
): ChecklistRow[] {
  const titles = provision.titleDocuments;
  const [mark, state]: [CheckMark, string] =
    titles.length === 0
      ? ['short', 'provision.req.missing']
      : titles.some(title => title.withinWindow === true)
        ? ['ok', 'provision.title.within']
        : titles.every(title => title.withinWindow === false)
          ? ['against', 'provision.title.outside']
          : ['open', 'provision.title.unknown'];

  const title: ChecklistRow = {
    key: 'title',
    label: t('provision.req.title_short'),
    mark,
    state: t(state),
    // The provision fold lists every title with the window it is held to,
    // which is what settles a row that is not simply "in the package".
    anchor: '#provision',
    docId: null,
  };

  if (provision.outcome !== 'Determined') return [title];

  return [
    title,
    ...(provision.provisions[0]?.requirements ?? []).map(requirement =>
      requirementRow(t, requirement, documents),
    ),
  ];
}

const VERDICT_MARK: Record<CrossCheckVerdict, CheckMark> = {
  Match: 'ok',
  Mismatch: 'against',
  Unclear: 'open',
};

const VERDICT_KEY: Record<CrossCheckVerdict, string> = {
  Match: 'detail.check_agreed',
  Mismatch: 'detail.check_disagreed',
  Unclear: 'detail.check_unclear',
};

export function crossCheckRows(
  t: Translate,
  checks: readonly CrossCheckDto[],
): ChecklistRow[] {
  return checks.map(check => ({
    key: check.key,
    label: translateOr(t, `check.${check.key}`, check.key),
    mark: VERDICT_MARK[check.verdict],
    state: t(VERDICT_KEY[check.verdict]),
    anchor: `#check-${check.key}`,
    docId: null,
  }));
}

/**
 * What the archive answered, one row a question.
 *
 * Only a contradiction or a missing original is drawn against the package. An
 * address the register has never heard of says nothing about the submission —
 * the archive holds the privatisations of two decades, not every house — so it
 * is quiet, and several records under one address is open: somebody has to
 * look (ADR-0009).
 */
export function archiveRows(
  t: Translate,
  pkg: Pick<
    PackageDetailDto,
    'registryChecks' | 'standing' | 'archiveSearchApprovals'
  >,
): ChecklistRow[] {
  const rows: ChecklistRow[] = pkg.registryChecks.map(
    (check: RegistryCheckDto) => ({
      key: check.key,
      label: translateOr(t, `check.${check.key}`, check.key),
      mark:
        check.outcome === 'Confirmed'
          ? 'ok'
          : speaksAgainst(check.outcome)
            ? 'against'
            : check.outcome === 'Ambiguous'
              ? 'open'
              : 'quiet',
      state: t(OUTCOME_KEY[check.outcome]),
      anchor: `#registry-${check.key}`,
      docId: null,
    }),
  );

  // The signature the standing waits on is a line of the checklist too — it is
  // the one move on this list that is the inspector's and nobody else's
  // (ADR-0016). Read off the standing, never worked out from the answers.
  if (pkg.standing === 'AwaitingArchiveApproval') {
    rows.push({
      key: 'approval',
      label: t('approve.title'),
      mark: 'open',
      state: t('standing.AwaitingArchiveApproval'),
      anchor: '#archive-approval',
      docId: null,
    });
  } else if (
    pkg.archiveSearchApprovals.some(approval => approval.supersededAt === null)
  ) {
    rows.push({
      key: 'approval',
      label: t('approve.title'),
      mark: 'ok',
      state: t('approve.given'),
      anchor: '#archive-approval',
      docId: null,
    });
  }

  return rows;
}

/** How many rows of a group are settled, over how many could be. A quiet row
 *  is neither — "0 of 1" over an address the archive never held would read as
 *  a shortfall the register never claimed — so it is not counted at all. */
export function tally(rows: readonly ChecklistRow[]): {
  done: number;
  total: number;
} {
  return {
    done: rows.filter(row => row.mark === 'ok').length,
    total: rows.filter(row => row.mark !== 'quiet').length,
  };
}

/** The loudest thing a group says, which is the ink its tally is set in. */
export function worstMark(rows: readonly ChecklistRow[]): CheckMark {
  const order: CheckMark[] = ['against', 'short', 'open', 'quiet', 'ok'];
  return order.find(mark => rows.some(row => row.mark === mark)) ?? 'ok';
}

/** Whether a group has nothing left for the eye — every row settled or quiet.
 *  A group like that folds to its heading; one with work in it stays open. */
export function isSettled(rows: readonly ChecklistRow[]): boolean {
  return rows.every(row => row.mark === 'ok' || row.mark === 'quiet');
}

/**
 * A finding's identity across polls, which is what its line in the rail is
 * keyed by.
 *
 * Built from what the finding is about and never from its position in the
 * report: a run that adds a finding shifts every index after it, and a line
 * keyed by index would be re-rendered as a different remark. Two findings the
 * report cannot tell apart share a key, and the page numbers the repeats.
 */
export function findingKey(issue: IssueDto): string {
  return [
    issue.kind,
    issue.documentId,
    issue.documentType,
    issue.fieldName,
    issue.checkKey,
    issue.pageNumber,
  ]
    .map(part => part ?? '')
    .join(':');
}
