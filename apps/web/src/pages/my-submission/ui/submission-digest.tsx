/**
 * The case sheet, short, in the applicant's own words.
 *
 * The office's case sheet answers what an inspector needs: every reading with
 * the confidence it was made with, every check with the two values it weighed,
 * which provision of Article 8 the case falls under. This sheet answers the
 * three questions the person who filed actually has — *did my papers arrive,
 * did they say what I said, and how far has it got* — and the panel below it
 * answers the fourth, which is the only one they can act on.
 *
 * **It exists because a list of gaps is not a report.** Before it, the cabinet
 * showed the standing and then what was still wanted, and nothing else: a
 * submission with nine of its eleven papers in and every reading agreed looked,
 * on the screen, exactly like a submission with nothing in it but two demands.
 * What the run got right was invisible, so waiting felt like nothing happening.
 * Every mark here is one the run has already settled — which is the point of
 * printing them (COMM-115).
 *
 * **It states and never decides**, like the sheet it is short for. There is no
 * verdict on it, no score, and nothing that reads as approval: the office
 * decides, and this page is one of the things they decide in front of.
 *
 * Three rules it is built to:
 *
 *  - **One account of the case, not a second one.** Every row is a
 *    `ChecklistRow` from `entities/verification-package/model/checklist` — the
 *    same rows the inspector's rail draws — and every mark is the same glyph in
 *    the same ink. A cabinet that worked out "is my paper in" for itself would
 *    sooner or later tell the applicant one thing and the office another about
 *    one package.
 *  - **No confidence figures.** A reading the engine was unsure of is said to
 *    be *being confirmed*, in words. The percentage is a fact about a scan,
 *    weighed against a floor this reader has no way to know; printed here it
 *    would be a number about their own title deed with nothing to do about it.
 *  - **The office's machine keeps its own names.** The nine pipeline stages are
 *    four phases here, and the checks are summed to one line each. An applicant
 *    asking what is happening to their papers is owed four sentences in their
 *    language, not nine in somebody else's.
 */
import type { ReactNode } from 'react';

import {
  APPLICANT_REPORT_KEY,
  APPLICANT_STANDING_NOTE,
  archiveRows,
  CheckGlyph,
  completenessRows,
  crossCheckRows,
  currentPhase,
  drawsOutcome,
  groundName,
  isSettled,
  MARK_INK,
  OutcomeMark,
  profileName,
  readWellEnough,
  REPORT_TONE,
  requiredTypes,
  RUN_PHASES,
  runPhases,
  stageStatuses,
  StandingMark,
  tally,
  toViewPackage,
  worstMark,
  type ChecklistRow,
  type CheckMark,
  type ProfileDto,
  type StageStatus,
} from '@/entities/verification-package';
import { relativeAgo, useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import type {
  PackageDetailDto,
  StatedValueDto,
} from '@cadastre/api-contracts/verification';

export function SubmissionDigest({
  pkg,
  profiles,
  shortfallKnown,
}: {
  pkg: PackageDetailDto;
  /** Empty while the profiles load, and then the sheet names no papers rather
   *  than the wrong ones. */
  profiles: readonly ProfileDto[];
  /** Whether the run has placed the package's papers, which is when a paper
   *  that is not here is a shortfall rather than a stage that has not run. The
   *  page decides it once for this list and for the gaps panel under it. */
  shortfallKnown: boolean;
}) {
  const { t, locale } = useI18n();

  const view = toViewPackage(pkg);
  const failed = view.disposition === 'failed';
  const running = !pkg.report && !failed;
  const stages = stageStatuses(pkg, view.disposition);

  const profile = profiles.find(p => p.key === pkg.profileKey) ?? null;
  const required = profile ? requiredTypes(profile) : [];
  const documents = pkg.files.flatMap(file => file.documents);
  const papers =
    profile && required.length > 0 && shortfallKnown
      ? completenessRows(t, {
          required,
          gaps: pkg.gaps,
          provision: pkg.provision,
          documents,
        }).map(applicantAnchor)
      : null;

  return (
    <article className='overflow-hidden rounded-xl border border-rule bg-card shadow-[var(--shadow-sm)]'>
      {/* ── Where it stands ──
          The whole of the news, in the words a person waiting for an answer
          reads, and the move it names beside it. Read off the contract's
          standing and never worked out here (ADR-0014). */}
      <div className='border-b border-rule bg-secondary/60 px-5 py-4 md:px-6'>
        <div className='flex flex-wrap items-center gap-x-4 gap-y-1'>
          <StandingMark standing={pkg.standing} voice='applicant' />
          <span className='ml-auto shrink-0 text-[0.75rem] text-muted-foreground'>
            {t('updated.when', {
              t: relativeAgo(pkg.updatedAt, Date.now(), locale),
            })}
          </span>
        </div>
        <p className='mt-1.5 max-w-[68ch] text-[0.875rem] leading-relaxed text-foreground/80'>
          {t(APPLICANT_STANDING_NOTE[pkg.standing])}
        </p>
        {/* Only where it says something the standing above has not — the same
            judgement the office's register makes about its own two words. */}
        {pkg.reportStatus !== null &&
          drawsOutcome(pkg.standing, pkg.reportStatus, false) && (
            <span className='mt-2 flex'>
              <OutcomeMark
                tone={REPORT_TONE[pkg.reportStatus]}
                label={t(APPLICANT_REPORT_KEY[pkg.reportStatus])}
              />
            </span>
          )}
        {(running || failed) && (
          <PhaseTrack phases={runPhases(stages)} className='mt-3.5' />
        )}
      </div>

      {/* ── What the papers say, over what was stated at filing ──
          The two are kept apart and labelled apart, as they are on the office's
          sheet: one is a reading off a scan and can be read badly, the other is
          what a person typed and cannot (ADR-0021). Side by side is the whole
          use of printing them here — a name read off the deed that does not
          match the name on the form is the thing an applicant can see at a
          glance and nobody else can. */}
      <div className='grid gap-x-8 gap-y-6 px-5 py-5 md:grid-cols-2 md:px-6'>
        <Group title={t('mine.one.read_off')}>
          <Line label={t('sheet.applicant')}>
            <Reading value={pkg.applicantName} running={running} />
          </Line>
          <Line label={t('sheet.address')}>
            <Reading value={pkg.propertyAddress} running={running} />
          </Line>
          <Line label={t('sheet.cadastral')}>
            {/* A cadastral number is an identifier and set in the register's
                mono face like every other figure (The Tabular Rule). */}
            <Reading figure value={pkg.cadastralNumber} running={running} />
          </Line>
        </Group>

        <Group title={t('mine.one.stated')}>
          <Line label={t('mine.one.kind')}>
            <span>{profileName(t, pkg.profileKey)}</span>
          </Line>
          <Line label={t('mine.new.basis')}>
            <Stated
              value={
                pkg.declared.legalBasis === null
                  ? null
                  : groundName(t, pkg.declared.legalBasis)
              }
            />
          </Line>
          <Line label={t('mine.new.year')}>
            <Stated
              figure
              value={
                pkg.declared.builtYear === null
                  ? null
                  : String(pkg.declared.builtYear)
              }
            />
          </Line>
        </Group>
      </div>

      {/* ── Your documents ──
          Every paper this application is checked against, each said to be in or
          not — the office's own list, drawn from the same rows and the same
          marks. A tick here is the one thing the cabinet never used to show. */}
      <section className='border-t border-rule px-5 py-5 md:px-6'>
        <Heading
          title={t('mine.one.documents')}
          aside={papers && <Tally rows={papers} />}
        />
        {papers === null ? (
          <p className='mt-2 max-w-[65ch] text-[0.8125rem] leading-relaxed text-muted-foreground'>
            {profile === null || required.length === 0
              ? t('mine.one.documents_unknown')
              : t('mine.one.documents_reading')}
          </p>
        ) : (
          <ul className='mt-1.5'>
            {papers.map(row => (
              <PaperLine key={row.key} row={row} />
            ))}
          </ul>
        )}
      </section>

      {/* ── What has been checked ──
          One line a group and never the rows themselves. Which two values a
          check weighed, and how sure each was read, is the inspector's to read;
          that the check was made, and how it came back, is everybody's. */}
      <section className='border-t border-rule px-5 py-5 md:px-6'>
        <Heading title={t('mine.one.checks')} />
        <ul className='mt-1.5'>
          <CheckLine
            label={t('mine.one.checks.papers')}
            rows={crossCheckRows(t, pkg.crossChecks)}
            words={CROSS_STATE}
            empty='mine.one.checks.empty'
            running={running}
          />
          <CheckLine
            label={t('mine.one.checks.archive')}
            // The office's own sign-off on the archive search is a line of the
            // inspector's rail and not of this one: it is a move nobody outside
            // the office has, and the standing above already says it is waited
            // on (ADR-0016).
            rows={archiveRows(t, pkg).filter(row => row.key !== 'approval')}
            words={ARCHIVE_STATE}
            empty='mine.one.archive.empty'
            running={running}
          />
        </ul>
      </section>
    </article>
  );
}

// ─── How far the run got ──────────────────────────────────────────────────────

/**
 * The run as four cells and the name of the one it is in.
 *
 * Segmented and not a single bar, because the phases are four named things that
 * happen in order and not one quantity filling up: a reader who comes back in
 * ten minutes should be able to see *which* of them moved. The cells are the
 * register's own stage-bar vocabulary, widened — there are four of them here
 * and nine on the office's row.
 *
 * Shown only while there is something to watch. Four settled cells reporting
 * history would sit above the fact the reader came for.
 */
function PhaseTrack({
  phases,
  className,
}: {
  phases: readonly StageStatus[];
  className?: string;
}) {
  const { t } = useI18n();
  const at = currentPhase(phases);

  return (
    <div className={className}>
      <div
        className='flex items-center gap-[3px]'
        role='progressbar'
        aria-valuemin={0}
        aria-valuemax={RUN_PHASES}
        aria-valuenow={at}
        aria-label={t('mine.one.phase', { k: at, n: RUN_PHASES })}
      >
        {phases.map((phase, i) => (
          <span
            key={i}
            className={cn(
              'h-[6px] flex-1 rounded-full transition-colors duration-500',
              phase === 'done' && 'bg-foreground',
              phase === 'current' && 'bg-progress motion-safe:animate-pulse',
              phase === 'pending' && 'bg-rule',
              phase === 'error' && 'bg-failed',
            )}
          />
        ))}
      </div>
      <p className='mt-1.5 text-[0.75rem] leading-none text-muted-foreground'>
        <span data-mono className='text-foreground/70'>
          {at}/{RUN_PHASES}
        </span>{' '}
        · {t(`mine.one.phase.${at}`)}
      </p>
    </div>
  );
}

// ─── What the papers say, and what was stated ────────────────────────────────

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className='min-w-0'>
      <h2 className='text-[0.8125rem] font-semibold text-foreground'>
        {title}
      </h2>
      <dl className='mt-1'>{children}</dl>
    </div>
  );
}

/** A label in sentence case over its value on a phone, beside it from `sm`. */
function Line({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className='flex flex-col gap-0.5 border-b border-rule py-2 last:border-0 sm:flex-row sm:items-baseline sm:gap-4'>
      <dt className='shrink-0 text-[0.8125rem] text-muted-foreground sm:w-[8rem]'>
        {label}
      </dt>
      <dd className='min-w-0 text-[0.875rem] text-foreground'>{children}</dd>
    </div>
  );
}

/**
 * A value the engine read off the papers — and, where it was unsure, the word
 * for that and never the figure.
 *
 * The office's sheet prints the percentage here, because an inspector has the
 * floor to weigh it against and a decision that turns on it. This reader has
 * neither, and a number beside their own address would only ask them to worry
 * about a scan they cannot re-take any better than they already did — which the
 * gaps panel below already offers them, in the one case where it helps.
 */
function Reading({
  value,
  running,
  figure = false,
}: {
  value: StatedValueDto | null;
  running: boolean;
  /** Whether the value is a figure a reader scans rather than prose. */
  figure?: boolean;
}) {
  const { t } = useI18n();
  if (value === null) {
    return (
      <span className='text-muted-foreground/70'>
        {t(running ? 'mine.one.unread' : 'mine.one.unfound')}
      </span>
    );
  }
  return (
    <span className='flex min-w-0 flex-wrap items-baseline gap-x-2'>
      <span data-mono={figure ? '' : undefined}>{value.value}</span>
      {!readWellEnough(value.confidence) && (
        <span className='shrink-0 text-[0.75rem] text-incomplete-ink'>
          {t('mine.one.unsure')}
        </span>
      )}
    </span>
  );
}

/** A value somebody typed. Never drawn with a confidence — a declaration
 *  carries none, and the moment one is shown among readings a figure nobody
 *  checked reads as one the engine found (ADR-0021). */
function Stated({
  value,
  figure = false,
}: {
  value: string | null;
  figure?: boolean;
}) {
  const { t } = useI18n();
  if (value === null) {
    return (
      <span className='text-muted-foreground/70'>{t('mine.one.unstated')}</span>
    );
  }
  return <span data-mono={figure ? '' : undefined}>{value}</span>;
}

// ─── The two lists ────────────────────────────────────────────────────────────

function Heading({ title, aside }: { title: string; aside?: ReactNode }) {
  return (
    <div className='flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule pb-2'>
      <h2 className='text-[0.9375rem] font-semibold tracking-[-0.01em] text-foreground'>
        {title}
      </h2>
      {aside}
    </div>
  );
}

/** Settled over countable, in the ink of the loudest thing the list says. */
function Tally({ rows }: { rows: readonly ChecklistRow[] }) {
  const { t } = useI18n();
  const { done, total } = tally(rows);
  if (total === 0) return null;

  return (
    <span
      data-mono
      className={cn(
        'shrink-0 text-[0.8125rem] font-medium tabular-nums',
        isSettled(rows) ? 'text-muted-foreground' : MARK_INK[worstMark(rows)],
      )}
    >
      {t('detail.required_found', { n: done, total })}
    </span>
  );
}

/**
 * One paper: its mark, its name, and the word the mark stands for.
 *
 * A settled row keeps its word for a screen reader only. Nine lines each ending
 * "In package" is one fact printed nine times, and it would bury the one line
 * that does not say it — which is the line this list exists to make findable.
 */
function PaperLine({ row }: { row: ChecklistRow }) {
  const settled = row.mark === 'ok';
  const body = (
    <>
      <CheckGlyph mark={row.mark} className='mt-px' />
      <span
        className={cn(
          'min-w-0 flex-1 text-[0.875rem] leading-snug',
          settled ? 'text-foreground/75' : 'text-foreground',
        )}
      >
        {row.label}
      </span>
      <span
        className={cn(
          'shrink-0 text-[0.75rem] font-medium',
          settled ? 'sr-only' : MARK_INK[row.mark],
        )}
      >
        {row.state}
      </span>
    </>
  );

  const shape = 'flex items-start gap-2.5 py-2.5';

  return (
    <li className='border-b border-rule last:border-0'>
      {row.anchor ? (
        <a
          href={row.anchor}
          className={cn(
            shape,
            '-mx-2 rounded-md px-2 transition-colors hover:bg-foreground/4 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
          )}
        >
          {body}
        </a>
      ) : (
        <div className={shape}>{body}</div>
      )}
    </li>
  );
}

/** What a group of checks came back as, in the applicant's words: the loudest
 *  mark it holds, the word for that mark, and how many of them are settled. */
const CROSS_STATE: Record<CheckMark, string> = {
  ok: 'mine.one.checks.ok',
  short: 'mine.one.checks.open',
  against: 'mine.one.checks.against',
  open: 'mine.one.checks.open',
  quiet: 'mine.one.checks.quiet',
};

const ARCHIVE_STATE: Record<CheckMark, string> = {
  ok: 'mine.one.archive.ok',
  short: 'mine.one.archive.open',
  against: 'mine.one.archive.against',
  open: 'mine.one.archive.open',
  quiet: 'mine.one.archive.quiet',
};

function CheckLine({
  label,
  rows,
  words,
  empty,
  running,
}: {
  label: string;
  rows: readonly ChecklistRow[];
  words: Record<CheckMark, string>;
  /** What the line says when the stage has run and had nothing to compare —
   *  which is not the same as a stage that has not run, and is not a fault. */
  empty: string;
  running: boolean;
}) {
  const { t } = useI18n();
  // A stage that has not answered yet is not a stage that answered nothing.
  const waiting = rows.length === 0 && running;
  const mark: CheckMark =
    rows.length === 0 ? 'quiet' : isSettled(rows) ? 'ok' : worstMark(rows);
  const { done, total } = tally(rows);

  return (
    <li className='flex items-start gap-2.5 border-b border-rule py-2.5 last:border-0'>
      {waiting ? (
        // Sized like the glyphs above and below it, so the column of marks down
        // the left edge stays a column while a stage is still working.
        <span
          aria-hidden
          className='mt-px grid size-[1.125rem] shrink-0 place-items-center'
        >
          <span className='size-2 rounded-full bg-progress motion-safe:animate-pulse' />
        </span>
      ) : (
        <CheckGlyph mark={mark} className='mt-px' />
      )}
      {/* The answer wraps under the question rather than squeezing it: at a
          phone's width the three parts on one line left the label three words
          deep and the tally broken across two lines. */}
      <div className='flex min-w-0 flex-1 flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5'>
        <span className='text-[0.875rem] leading-snug text-foreground'>
          {label}
        </span>
        <span className='flex shrink-0 items-baseline gap-2'>
          <span
            className={cn(
              'text-[0.75rem] font-medium',
              waiting ? 'text-progress' : MARK_INK[mark],
            )}
          >
            {waiting
              ? t('mine.one.checks.pending')
              : rows.length === 0
                ? t(empty)
                : t(words[mark])}
          </span>
          {total > 0 && (
            <span
              data-mono
              className='whitespace-nowrap text-[0.75rem] tabular-nums text-muted-foreground'
            >
              {t('detail.required_found', { n: done, total })}
            </span>
          )}
        </span>
      </div>
    </li>
  );
}

// ─── Rows, as this surface reads them ────────────────────────────────────────

/**
 * The same row, pointed where this page can go.
 *
 * The office's rows jump to the scan a finding was made on; the cabinet has no
 * scans on it. A paper that is missing points at the panel that takes it — the
 * one move the reader has — and a paper that is in points nowhere, because
 * there is nothing here to look at and a link that scrolls to itself is a
 * promise the page does not keep.
 */
function applicantAnchor(row: ChecklistRow): ChecklistRow {
  return {
    ...row,
    anchor: row.mark === 'ok' || row.mark === 'quiet' ? null : '#document-gaps',
    docId: null,
  };
}
