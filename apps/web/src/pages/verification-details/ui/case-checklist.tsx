/**
 * The checklist beside the case — the four questions an inspector runs down
 * before deciding, each answered in a line and each line a jump to its
 * evidence: are the papers here, did they agree with each other, what did the
 * archive say, and what the report remarks on.
 *
 * It is an index and never a verdict, and it only informs: every mark is the
 * server's answer, grouped (see `entities/verification-package/model/checklist`
 * — the same rows the applicant's cabinet sums), and nothing on the rail
 * can be ticked or changed. A tick kept in one browser was a mark that looked
 * like a record and recorded nothing.
 *
 * Every fold starts shut: the rail opens as four headings, each with its mark
 * and tally, so what needs work is read off the headings and unfolded on
 * demand rather than laid out down the side of the case (COMM-109).
 */
import { ChevronRightIcon, CornerDownRightIcon } from 'lucide-react';
import { useState, type ReactNode } from 'react';

import {
  archiveRows,
  CheckGlyph,
  completenessRows,
  crossCheckRows,
  isSettled,
  MARK_INK,
  provisionName,
  provisionRows,
  provisionShort,
  ReadingFigure,
  requiredTypes,
  tally,
  worstMark,
  type ChecklistRow,
  type CheckMark,
  type ProfileDto,
} from '@/entities/verification-package';
import { useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import type { Jump } from '@/shared/lib/jump';
import { CONFIDENCE_FLOOR } from '@cadastre/api-contracts/verification';
import type {
  IssueKind,
  PackageDetailDto,
} from '@cadastre/api-contracts/verification';

/** One remark as the worklist names it, keyed by what it is about. */
export type FindingLine = {
  key: string;
  subject: string;
  where: string;
  anchor: string | null;
  docId: string | null;
  confidence: number | null;
};

export type FindingGroup = {
  kind: IssueKind;
  heading: string;
  lines: FindingLine[];
};

const JUMP_SHAPE =
  '-mx-2 rounded-md px-2 transition-colors hover:bg-foreground/4 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50';

type SectionId = 'documents' | 'checks' | 'archive' | 'findings';

export function CaseChecklist({
  pkg,
  profile,
  settled,
  running,
  findings,
  onJump,
}: {
  pkg: PackageDetailDto;
  /** Null while the profiles load, and then the rail names no papers rather
   *  than the wrong ones. */
  profile: ProfileDto | null;
  /** Whether classification has been through every document — before it, a
   *  paper's absence is a stage that has not run, not a shortfall. */
  settled: boolean;
  running: boolean;
  findings: readonly FindingGroup[];
  onJump: Jump;
}) {
  const { t } = useI18n();
  const [folds, setFolds] = useState<Partial<Record<SectionId, boolean>>>({});

  const documents = pkg.files.flatMap(file => file.documents);
  const required = profile ? requiredTypes(profile) : [];
  const provision = pkg.provision;
  const knowsPapers = profile !== null && required.length > 0;
  const completeness =
    knowsPapers && settled
      ? completenessRows(t, {
          required,
          gaps: pkg.gaps,
          provision,
          documents,
        })
      : null;
  const provisional = provision ? provisionRows(t, provision, documents) : null;
  // What the fold's heading counts: each paper once. A permit the provision
  // asks for is listed under completeness and again under the provision, and
  // counting it twice read "5 of 9" over six papers.
  const paperRows = [
    ...new Map(
      [...(completeness ?? []), ...(provisional ?? [])].map(row => [
        row.key,
        row,
      ]),
    ).values(),
  ];
  const checks = crossCheckRows(t, pkg.crossChecks);
  const archive = archiveRows(t, pkg);
  const lines = findings.flatMap(group => group.lines);

  const fold = (id: SectionId) => ({
    open: folds[id] ?? false,
    onToggle: () =>
      setFolds(current => ({ ...current, [id]: !(current[id] ?? false) })),
  });

  return (
    <div className='flex flex-col'>
      <Section
        id='rail-documents'
        title={t('sheet.section.documents')}
        status={
          <RowsStatus
            rows={paperRows}
            pending={completeness === null && running}
          />
        }
        {...fold('documents')}
      >
        <Group
          title={t('rail.completeness')}
          aside={completeness && <Count rows={completeness} />}
        >
          {completeness === null ? (
            <Quiet>
              {knowsPapers
                ? t('detail.required_pending')
                : t('sheet.documents.unknown')}
            </Quiet>
          ) : (
            <Rows rows={completeness} onJump={onJump} />
          )}
          {/* Until one provision applies, what else the package owes is not
              known — said, rather than left for the inspector to infer from a
              list that looks complete. */}
          {completeness && provision && provision.outcome !== 'Determined' && (
            <JumpLine anchor='#provision' onJump={onJump}>
              {t('rail.completeness_more')}
            </JumpLine>
          )}
        </Group>

        {provision && provisional && (
          <Group
            title={
              provision.outcome === 'Determined' && provision.provision
                ? t('rail.provision', { code: provision.provision })
                : t('panel.provision')
            }
            detail={
              provision.outcome === 'Determined' && provision.provision
                ? provisionName(t, provision.provision)
                : provisionShort(t, provision)
            }
            aside={<Count rows={provisional} />}
          >
            <Rows rows={provisional} onJump={onJump} />
            {provision.outcome !== 'Determined' && (
              <JumpLine anchor='#provision' onJump={onJump}>
                {t('rail.provision_go')}
              </JumpLine>
            )}
          </Group>
        )}
      </Section>

      <Section
        id='rail-checks'
        title={t('rail.checks')}
        status={
          <RowsStatus rows={checks} pending={checks.length === 0 && running} />
        }
        {...fold('checks')}
      >
        {checks.length === 0 ? (
          <Quiet>
            {running ? t('detail.checks_pending') : t('checks.none')}
          </Quiet>
        ) : (
          <Rows rows={checks} onJump={onJump} />
        )}
      </Section>

      <Section
        id='rail-archive'
        title={t('rail.archive')}
        status={
          <RowsStatus
            rows={archive}
            pending={pkg.registryChecks.length === 0 && running}
          />
        }
        {...fold('archive')}
      >
        {archive.length === 0 ? (
          <Quiet>
            {running ? t('detail.registry_pending') : t('registry.none')}
          </Quiet>
        ) : (
          <Rows rows={archive} onJump={onJump} />
        )}
      </Section>

      <Section
        id='rail-findings'
        title={t('rail.findings')}
        status={
          <FindingsStatus
            total={lines.length}
            pending={!pkg.report && running}
          />
        }
        {...fold('findings')}
      >
        {!pkg.report ? (
          <Quiet>
            {running
              ? t('detail.review_preparing_note')
              : t('detail.review_unavailable')}
          </Quiet>
        ) : lines.length === 0 ? (
          <Quiet>{t('detail.clean')}</Quiet>
        ) : (
          findings.map(group => (
            <Group
              key={group.kind}
              title={t(group.heading)}
              aside={
                <span
                  data-mono
                  className='shrink-0 text-[0.6875rem] tabular-nums text-muted-foreground'
                >
                  {group.lines.length}
                </span>
              }
            >
              <ul className='mt-1 flex flex-col'>
                {group.lines.map(line => (
                  <FindingItem
                    key={line.key}
                    line={line}
                    mark={FINDING_MARK[group.kind] ?? 'against'}
                    onJump={onJump}
                  />
                ))}
              </ul>
            </Group>
          ))
        )}
      </Section>
    </div>
  );
}

// ─── The four folds ───────────────────────────────────────────────────────────

function Section({
  id,
  title,
  status,
  open,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  status: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className='border-t border-rule first:border-t-0'>
      <h3>
        {/* A button and a region, not `<details>`: the page polls while a run
            is under way, and React does not keep `open` on a `<details>` it
            has already mounted — the same reason the case file's folds are
            built this way. */}
        <button
          type='button'
          aria-expanded={open}
          aria-controls={`${id}-rows`}
          onClick={onToggle}
          className={cn(
            JUMP_SHAPE,
            'flex w-[calc(100%+1rem)] items-center gap-2 py-2.5 text-left',
          )}
        >
          <ChevronRightIcon
            aria-hidden
            className={cn(
              'size-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
              open && 'rotate-90',
            )}
          />
          <span className='min-w-0 flex-1 text-[0.8125rem] font-semibold leading-snug text-foreground'>
            {title}
          </span>
          {status}
        </button>
      </h3>
      {open && (
        <div id={`${id}-rows`} className='pb-3.5 pl-5.5'>
          {children}
        </div>
      )}
    </section>
  );
}

function Group({
  title,
  detail,
  aside,
  children,
}: {
  title: string;
  /** A few words under the title — what the provision is, in plain terms. */
  detail?: string;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className='mt-3.5 first:mt-0.5'>
      <div className='flex items-baseline justify-between gap-3'>
        <h4 className='min-w-0 text-[0.75rem] font-medium leading-snug text-muted-foreground'>
          {title}
        </h4>
        {aside}
      </div>
      {detail && (
        <p className='text-[0.6875rem] leading-snug text-muted-foreground/80'>
          {detail}
        </p>
      )}
      {children}
    </div>
  );
}

// ─── Rows ─────────────────────────────────────────────────────────────────────

function Rows({
  rows,
  onJump,
}: {
  rows: readonly ChecklistRow[];
  onJump: Jump;
}) {
  return (
    <ul className='mt-1 flex flex-col'>
      {rows.map(row => (
        <CheckRow key={row.key} row={row} onJump={onJump} />
      ))}
    </ul>
  );
}

/**
 * A line of the checklist: the mark, what it is about, and — where it is not
 * simply in order — the word the mark stands for, under it. A settled row keeps
 * its word for a screen reader only: eight lines each ending "In the package"
 * is one fact printed eight times, and it would bury the one that is not.
 */
function CheckRow({ row, onJump }: { row: ChecklistRow; onJump: Jump }) {
  const settled = row.mark === 'ok';

  const body = (
    <>
      <CheckGlyph mark={row.mark} className='mt-px' />
      <span className='min-w-0 flex-1'>
        <span
          className={cn(
            'block text-[0.8125rem] leading-snug',
            settled ? 'text-foreground/75' : 'text-foreground',
          )}
        >
          {row.label}
        </span>
        <span
          className={cn(
            settled ? 'sr-only' : 'mt-0.5 block text-[0.75rem] leading-snug',
            !settled && MARK_INK[row.mark],
          )}
        >
          {row.state}
        </span>
      </span>
    </>
  );

  const shape = 'flex items-start gap-2.5 py-1.5';

  return (
    <li>
      {row.anchor ? (
        <a
          href={row.anchor}
          onClick={onJump(row.docId, row.anchor)}
          className={cn(shape, JUMP_SHAPE)}
        >
          {body}
        </a>
      ) : (
        <div className={shape}>{body}</div>
      )}
    </li>
  );
}

/**
 * Which mark a kind of remark is drawn with, so the list reads by the same
 * vocabulary as the rows above it: a paper that is not there is `short`, a
 * reading or a question nobody could settle is `open`, and the rest is
 * something on the papers that speaks against them.
 */
const FINDING_MARK: Partial<Record<IssueKind, CheckMark>> = {
  MissingDocument: 'short',
  MissingTitleDocument: 'short',
  WrongDocumentSupplied: 'short',
  UnreadableDocument: 'open',
  LowConfidence: 'open',
  ProvisionUndetermined: 'open',
};

/** A remark: its mark, what it is about, and where on the page to settle it. */
function FindingItem({
  line,
  mark,
  onJump,
}: {
  line: FindingLine;
  mark: CheckMark;
  onJump: Jump;
}) {
  const { t } = useI18n();
  const low = line.confidence !== null && line.confidence < CONFIDENCE_FLOOR;

  const text = (
    <>
      <CheckGlyph mark={mark} className='mt-px' />
      <span className='min-w-0 flex-1'>
        <span className='block text-[0.8125rem] leading-snug text-foreground'>
          {line.subject}
        </span>
        {(line.where || low) && (
          <span className='mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[0.75rem] leading-snug text-muted-foreground'>
            {line.where && <span className='min-w-0'>{line.where}</span>}
            {/* The figure a doubtful reading was made with, because that is the
              thing the inspector is being asked to look at (PRD §4.6) — on the
              same three-band scale the case card prints it in, so a remark in
              the rail and the row it jumps to are one colour (COMM-110). */}
            {low && line.confidence !== null && (
              <ReadingFigure confidence={line.confidence} />
            )}
          </span>
        )}
      </span>
    </>
  );

  const shape = 'flex items-start gap-2.5 py-1.5';

  return (
    <li>
      {line.anchor ? (
        <a
          href={line.anchor}
          onClick={onJump(line.docId, line.anchor)}
          title={t('detail.attention_go')}
          className={cn(shape, JUMP_SHAPE)}
        >
          {text}
        </a>
      ) : (
        <div className={shape}>{text}</div>
      )}
    </li>
  );
}

// ─── Small parts ──────────────────────────────────────────────────────────────

/** Settled over countable, in mono so the column of tallies aligns. A group of
 *  quiet rows only has nothing to count and says nothing. */
function Count({ rows }: { rows: readonly ChecklistRow[] }) {
  const { done, total } = tally(rows);
  if (total === 0) return null;

  return (
    <span
      data-mono
      className={cn(
        'shrink-0 text-[0.6875rem] tabular-nums',
        isSettled(rows) ? 'text-muted-foreground' : MARK_INK[worstMark(rows)],
      )}
    >
      {done}/{total}
    </span>
  );
}

/** What a closed fold says: a pulse while its stage is still working, then the
 *  loudest mark it holds beside its tally. */
function RowsStatus({
  rows,
  pending,
}: {
  rows: readonly ChecklistRow[];
  pending: boolean;
}) {
  if (pending) return <Pulse />;
  if (rows.length === 0) return null;

  const mark = isSettled(rows) ? 'ok' : worstMark(rows);
  const { done, total } = tally(rows);

  return (
    <span
      className={cn(
        'flex shrink-0 items-center gap-1 text-[0.6875rem] font-medium',
        MARK_INK[mark],
      )}
    >
      {/* The rows' own tinted mark, smaller: a bare minus beside a tally read
          as a dash in front of the number. */}
      <CheckGlyph mark={mark} size='tight' />
      {total > 0 && (
        <span data-mono className='tabular-nums'>
          {done}/{total}
        </span>
      )}
    </span>
  );
}

/** How many remarks the report makes — a count and not a tally, since there
 *  is nothing on the rail to settle them with. */
function FindingsStatus({
  total,
  pending,
}: {
  total: number;
  pending: boolean;
}) {
  if (pending) return <Pulse />;
  if (total === 0) return null;

  return (
    <span
      data-mono
      className='shrink-0 rounded-full bg-issues/14 px-1.5 text-[0.6875rem] font-medium tabular-nums text-issues-ink'
    >
      {total}
    </span>
  );
}

function Pulse() {
  return (
    <span
      aria-hidden
      className='size-1.5 shrink-0 rounded-full bg-primary motion-safe:animate-pulse'
    />
  );
}

function Quiet({ children }: { children: ReactNode }) {
  return (
    <p className='mt-1 text-[0.75rem] leading-snug text-muted-foreground'>
      {children}
    </p>
  );
}

function JumpLine({
  anchor,
  onJump,
  children,
}: {
  anchor: string;
  onJump: Jump;
  children: ReactNode;
}) {
  return (
    <a
      href={anchor}
      onClick={onJump(null, anchor)}
      className={cn(
        JUMP_SHAPE,
        'mt-1 flex items-baseline gap-1.5 py-1 text-[0.75rem] leading-snug text-muted-foreground hover:text-foreground',
      )}
    >
      <CornerDownRightIcon
        aria-hidden
        className='size-3 shrink-0 translate-y-0.5'
      />
      <span className='min-w-0'>{children}</span>
    </a>
  );
}
