/**
 * Verification details — the inspector's review surface for one package. Reads
 * live pipeline output from `GET /api/packages/:id`.
 *
 * The surface is an evidence workbench, not a scroll: a wide register of the
 * documents the engine read (label / value / confidence in aligned columns,
 * each entry disclosing the source text of its own sheets) beside a rail
 * that holds the package's state — how far the pipeline got, what the profile
 * still expects, and an index of what is in the package. The rail answers "did
 * it finish, is anything missing, what is in here"; the register answers "is
 * this value right", which is where the inspector's attention actually goes.
 *
 * A file is a container — one PDF may hold a passport and a title deed — so the
 * file is what the inspector recognises and the documents are what the engine
 * reports within it. Fields / validation / report appear here as those pipeline
 * stages are built. It reports evidence; it never states an approval or a
 * verdict.
 */
import { skipToken } from '@reduxjs/toolkit/query';
import {
  ArrowLeftIcon,
  CheckIcon,
  ChevronRightIcon,
  ClipboardListIcon,
  CornerDownRightIcon,
  EyeOffIcon,
  FileTextIcon,
  HistoryIcon,
  ImageIcon,
  MinusIcon,
  PlusIcon,
  PrinterIcon,
  StampIcon,
  TriangleAlertIcon,
} from 'lucide-react';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import {
  attestationLines,
  documentIn,
  ENTRIES_SHOWN,
  entriesOf,
  fieldAnchor,
  fieldRowId,
  fieldsReadHere,
  foldFields,
  groundName,
  HOLDING_KEY,
  HOLDING_TONE,
  holdsHash,
  isCarriedOver,
  ISSUE_KIND_KEY,
  isSuperseded,
  missingTypes,
  OUTCOME_NOTE,
  OutcomeMark,
  profileName,
  readReport,
  readWellEnough,
  RegistryOutcomeMark,
  requiredTypes,
  speaksAgainst,
  STAGES,
  STANDING_NOTE,
  StandingMark,
  supportingSetsOf,
  takesFiles,
  toViewPackage,
  useGetPackageQuery,
  useGetProfilesQuery,
  type Disposition,
  type MarkStanding,
  type ProfileDto,
  type SupportingSet,
  type VerificationPackage,
} from '@/entities/verification-package';
import { ApproveArchiveSearch } from '@/features/approve-archive-search';
import { DocumentGaps } from '@/features/supply-document';
import { AddFiles } from '@/features/upload-documents';
import { paths } from '@/shared/config';
import { formatDate, relativeShort, translateOr, useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import type { Jump } from '@/shared/lib/jump';
import { Button } from '@/shared/ui/button';
import { Skeleton } from '@/shared/ui/skeleton';
import { SurfaceBody, SurfacePage } from '@/shared/ui/surface';
import { CONFIDENCE_FLOOR } from '@cadastre/api-contracts/verification';
import type {
  CheckedValueDto,
  CrossCheckDto,
  CrossCheckVerdict,
  DocumentAttestationDto,
  DocumentDto,
  FieldDto,
  FieldSourceDto,
  IssueDto,
  IssueKind,
  PackageDetailDto,
  RegistryAttributeDto,
  RegistryCheckDto,
  RegistryDocumentDto,
  ReportDto,
  SourceFileDto,
  StatedValueDto,
} from '@cadastre/api-contracts/verification';

import { PANEL, panelForHash, type PanelId } from '../model/panels';

type Translate = (
  key: string,
  vars?: Record<string, string | number>,
) => string;

type StageStatus = 'done' | 'current' | 'pending' | 'error';

/**
 * Which folds the reader has opened or shut by hand, over the ones this page
 * would open by itself.
 *
 * A partial record and not a full one, because the defaults are not known when
 * the state is created: whether the attention fold opens depends on how many
 * findings the report holds, and the package has not arrived at first render.
 * So a fold is drawn by its default until somebody — the reader, or a jump —
 * says otherwise, and only then does an entry appear here.
 *
 * It has to be React state at all because `<details open={…}>` is controlled:
 * this page polls while a run is under way, and a fold opened by writing to the
 * DOM node would be shut again by the next render a poll caused.
 */
type PanelOverrides = Partial<Record<PanelId, boolean>>;

// ─── Pipeline, read down the rail ─────────────────────────────────────────────
// Vertical, because the nine stage names are long in all three languages and a
// horizontal run of them either wraps, truncates, or scrolls sideways. Read
// downward it is one narrow column: marker, stage, its score.
function StageMarker({ status, n }: { status: StageStatus; n: number }) {
  return (
    <span
      className={cn(
        'grid size-5 shrink-0 place-items-center rounded-full text-[0.625rem] font-semibold tabular-nums transition-colors duration-300',
        status === 'done' && 'bg-ok-ink text-background',
        status === 'current' && 'border-2 border-primary text-primary',
        status === 'pending' &&
          'border border-rule-strong text-muted-foreground',
        status === 'error' && 'bg-destructive text-white',
      )}
    >
      {status === 'done' ? (
        <CheckIcon className='size-3' strokeWidth={3} />
      ) : status === 'error' ? (
        <TriangleAlertIcon className='size-3' />
      ) : (
        n
      )}
    </span>
  );
}

function Pipeline({ stages }: { stages: StageStatus[] }) {
  const { t } = useI18n();
  return (
    <ol className='mt-3 flex flex-col'>
      {stages.map((st, i) => (
        <li key={i} className='flex gap-3'>
          <div className='flex flex-col items-center'>
            <StageMarker status={st} n={i + 1} />
            {i < stages.length - 1 && (
              <span
                aria-hidden
                className={cn(
                  'my-1 w-px flex-1 transition-colors duration-500',
                  st === 'done' ? 'bg-ok-ink/35' : 'bg-rule',
                )}
              />
            )}
          </div>
          <div
            className={cn('min-w-0 flex-1', i < stages.length - 1 && 'pb-3')}
          >
            <span
              className={cn(
                'text-[0.8125rem] leading-tight transition-colors duration-300',
                st === 'current'
                  ? 'font-medium text-primary'
                  : st === 'error'
                    ? 'font-medium text-failed-ink'
                    : st === 'done'
                      ? 'text-foreground/80'
                      : 'text-muted-foreground',
              )}
            >
              {t(`stage.${i + 1}`)}
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}

// How far the run got. Live while it works, and folded away into a single line
// once it is over: a finished run is six green marks reporting history, and it
// should not hold rail space ahead of the fact the inspector came for.
function RunProgress({
  stages,
  running,
  failed,
  stageRunning,
}: {
  stages: StageStatus[];
  running: boolean;
  failed: boolean;
  // Whether any stage is working — more than one can be, so this is a state of
  // the run rather than a position in it.
  stageRunning: boolean;
}) {
  const { t } = useI18n();
  return (
    <section>
      {running ? (
        <>
          <div className='flex items-baseline justify-between gap-3'>
            <h2 className='register-label'>{t('detail.process')}</h2>
            {stageRunning && (
              <span className='flex items-center gap-1.5 text-[0.6875rem] font-medium text-primary'>
                <span
                  aria-hidden
                  className='size-1.5 rounded-full bg-primary motion-safe:animate-pulse'
                />
                {t('detail.stage_running')}
              </span>
            )}
          </div>
          <Pipeline stages={stages} />
        </>
      ) : (
        <details className='group'>
          <summary className='-mx-2 flex cursor-pointer list-none select-none items-baseline gap-2 rounded-md px-2 py-1 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50'>
            <ChevronRightIcon className='size-3 shrink-0 translate-y-0.5 text-muted-foreground transition-transform duration-200 group-open:rotate-90' />
            <span className='register-label'>
              {failed ? t('status.failed') : t('detail.process_done')}
            </span>
            <span
              data-mono
              className='ml-auto shrink-0 text-[0.6875rem] tabular-nums text-muted-foreground/70'
            >
              {t('detail.stages_done', { n: stages.length })}
            </span>
          </summary>
          <Pipeline stages={stages} />
        </details>
      )}
    </section>
  );
}

/** Every document the engine found, across all uploaded files, in reading
 *  order. */
function documentsOf(pkg: PackageDetailDto): DocumentDto[] {
  return pkg.files.flatMap(file => file.documents);
}

// ─── What the register is filtered by ────────────────────────────────────────
// A package this size is mostly settled work: of sixteen documents the engine
// read here, six carry a reading the inspector should look at and eight are not
// documents this profile asks for at all. Rendering all of them at equal weight
// is what buries the six. The segments are the register's own triage — the same
// control the package register uses, with the same counts.
type DocSegment = 'review' | 'all' | 'other';

const SEGMENTS: DocSegment[] = ['review', 'all', 'other'];

const SEGMENT_KEY: Record<DocSegment, string> = {
  review: 'detail.seg.review',
  all: 'detail.seg.all',
  other: 'detail.seg.other',
};

/** A paper the catalogue could not name: read, placed, and not one of the
 *  grounds the law lists. It is evidence of what was in the envelope, never a
 *  shortfall. */
function isAside(doc: DocumentDto): boolean {
  return doc.type === 'out_of_profile';
}

/** Whether this document holds anything the inspector should actually look at:
 *  a reading below the floor, or a type the classifier could not place. Its
 *  answer decides both the segment a document falls in and whether the entry
 *  opens with its fields showing.
 *
 *  Only what was read off this paper counts. A value carried in from another
 *  document of the package may well sit under the floor — it is the source's
 *  reading, discounted — but the doubt is about the sheet it was read on, and
 *  it is already reported there (ADR-0023). Counting it here would send the
 *  inspector to a paper with nothing on it to look at. */
function needsReview(doc: DocumentDto): boolean {
  // A scan a later arrival has pushed out of force is the record of what was
  // sent first, not a paper the case rests on: the report, the checks and the
  // register's questions are all worked out from the documents in force
  // (COMM-80). Counting its faults here would send the inspector to settle a
  // reading nothing is decided on, and would count the work twice — once on the
  // spent scan and once on the one that replaced it.
  if (isSuperseded(doc)) return false;
  if (doc.type === null || doc.type === 'unknown') return true;
  if (isAside(doc)) return false;
  if (
    doc.classificationConfidence != null &&
    doc.classificationConfidence < CONFIDENCE_FLOOR
  )
    return true;
  return fieldsReadHere(doc.fields).some(f => f.confidence < CONFIDENCE_FLOOR);
}

function inSegment(doc: DocumentDto, segment: DocSegment): boolean {
  if (segment === 'all') return true;
  if (segment === 'other') return isAside(doc);
  return needsReview(doc);
}

/** Rendered *and* spelled out. Under "all" the service sheets are in the
 *  register but folded into the line that stands for them, so a jump aimed at
 *  one has to land somewhere else — being on the page is not the same as being
 *  reachable. */
function isOpenIn(doc: DocumentDto, segment: DocSegment): boolean {
  if (!inSegment(doc, segment)) return false;
  return !(segment === 'all' && isAside(doc));
}

/** Real per-stage status from pipeline output. A stage that could not do its
 *  work no longer halts the run: it is marked done-with-a-finding and the run
 *  walks on, because the report is what the inspector is owed. Only a run that
 *  lost the package altogether ends in error. */
function stageStatuses(
  pkg: PackageDetailDto,
  disposition: Disposition,
): StageStatus[] {
  const files = pkg.files;
  const documents = documentsOf(pkg);
  const ocrDone =
    files.length > 0 &&
    files.every(f => f.pages.length > 0 && f.pages.every(p => p.ocr !== null));
  // Every file has been read into the documents it holds. A file that holds
  // nothing has not been detected yet, not detected as empty.
  const detectDone =
    files.length > 0 && files.every(f => f.documents.length > 0);
  const classifyDone = detectDone && documents.every(d => d.type !== null);
  // Extraction is done once every document with a schema behind it has its
  // fields. Neither answer the engine keeps for itself declares any: a document
  // it could not place has nothing to extract, and one it placed outside the
  // profile has no schema to extract against.
  const extractDone =
    classifyDone &&
    documents
      .filter(
        d => d.type && d.type !== 'unknown' && d.type !== 'out_of_profile',
      )
      .every(d => d.fields.length > 0);
  // The first check to come back is what says the stage is under way; a run
  // that finished takes the branch below, so a package no check could be made
  // over never sits here waiting.
  const crossDone = extractDone && pkg.crossChecks.length > 0;
  // The register is asked once the values it holds against a record exist, and
  // it is answered per check, so the first answer back says the stage is under
  // way — the same reading as the cross-document stage above it.
  const registryDone = crossDone && pkg.registryChecks.length > 0;

  const stages: StageStatus[] = Array.from({ length: STAGES }, () => 'pending');
  if (disposition === 'failed') {
    stages[0] = ocrDone ? 'done' : 'error';
    if (ocrDone) stages[1] = detectDone ? 'done' : 'error';
    if (ocrDone && detectDone) stages[2] = 'error';
    return stages;
  }
  // A finished run compiled its report, so every stage behind it has had its
  // turn — whatever each of them managed to make of the package.
  if (pkg.report) return stages.map(() => 'done');

  stages[0] = ocrDone ? 'done' : 'current';
  stages[1] = detectDone ? 'done' : ocrDone ? 'current' : 'pending';
  if (!detectDone) return stages;
  // Classification and extraction are one pass, not two: the run takes a
  // document, places it, and reads its fields before moving to the next. So
  // while that pass is under way both are genuinely working and both are marked
  // running — showing extraction as "not started" until the last document is
  // placed would report a queue the run does not have.
  stages[2] = classifyDone ? 'done' : 'current';
  stages[3] = extractDone ? 'done' : 'current';
  stages[4] = crossDone ? 'done' : extractDone ? 'current' : 'pending';
  stages[5] = registryDone ? 'done' : crossDone ? 'current' : 'pending';
  // Gathering starts once the register has answered, and nothing in the
  // response says when it ends: a run that carried nothing over looks exactly
  // like a run that has not reached the stage. What says it is over is the
  // report, and the branch above already answers "done" to everything once that
  // has landed (ADR-0023).
  stages[6] = registryDone ? 'current' : 'pending';
  return stages;
}

// ─── Confidence ────────────────────────────────────────────────────────────────
// A machine-read value: tabular mono, and below the engine's own floor it flags
// for review in the clay "incomplete" ink (PRD §4.6). Above the floor it stays
// a quiet figure in its own column — a reading the engine is sure of must not
// shout down the value it produced.
//
// The threshold is the contract's `CONFIDENCE_FLOOR` and never a copy of it.
// This screen used to keep its own 0.8 beside the engine's, which is two
// numbers called "low confidence" in one product: the first time they disagreed
// this column would highlight a value the report is content with, or leave a
// flagged one plain (COMM-80).
//
// How well a value was read and where it came from are two statements, and
// since ADR-0023 the field carries both: this column answers the first, and the
// marks beside the value answer the second. A value carried over from another
// paper of the package is the source's reading discounted, so it can arrive
// under the floor with nothing on this sheet to check — which is why the row
// showing it drops the "needs review" chip and keeps the figure.

// Zero is not "certainly wrong", it is "nobody scored this": neither the route
// nor the model would say how sure it was, so the engine declines to make a
// number up (docs/MODELS.md). It reads as an absence, and it still flags for
// review — an unscored reading is exactly one an inspector should check.
function Confidence({
  value,
  bare = false,
}: {
  value: number;
  bare?: boolean;
}) {
  const { t } = useI18n();
  const unscored = value === 0;
  const low = value < CONFIDENCE_FLOOR;
  return (
    <span className='inline-flex shrink-0 items-baseline justify-end gap-1.5'>
      {low && !bare && (
        <span className='rounded-full bg-incomplete/12 px-1.5 py-0.5 text-[0.625rem] font-medium text-incomplete-ink'>
          {t('detail.needs_review')}
        </span>
      )}
      <span
        data-mono
        className={cn(
          'text-[0.75rem] tabular-nums',
          low ? 'font-medium text-incomplete-ink' : 'text-muted-foreground/80',
        )}
        title={unscored ? t('detail.unscored_why') : undefined}
      >
        {unscored ? t('detail.unscored') : `${Math.round(value * 100)}%`}
      </span>
    </span>
  );
}

// A single labelled status marker: tinted dot-chip + word, never colour alone.
function StatusLine({
  tone,
  icon,
  label,
}: {
  tone: 'ok' | 'fail' | 'pending';
  icon: ReactNode;
  label: string;
}) {
  return (
    <span className='flex items-center gap-2 text-[0.8125rem]'>
      <span
        className={cn(
          'grid size-5 shrink-0 place-items-center rounded-full',
          tone === 'ok' && 'bg-ok/12 text-ok-ink',
          tone === 'fail' && 'bg-failed/12 text-failed-ink',
          tone === 'pending' && 'text-primary',
        )}
      >
        {icon}
      </span>
      <span
        className={cn(
          tone === 'fail'
            ? 'font-medium text-failed-ink'
            : 'text-foreground/80',
        )}
      >
        {label}
      </span>
    </span>
  );
}

// The disclosure every raw transcription opens into — the machine's reading,
// set in mono on a recessed panel so it never passes for extracted data.
function Transcript({ label, text }: { label: string; text: string }) {
  return (
    <details className='group mt-3'>
      <summary className='inline-flex cursor-pointer list-none select-none items-center gap-1.5 text-[0.75rem] text-muted-foreground transition-colors hover:text-foreground'>
        <ChevronRightIcon className='size-3 transition-transform duration-200 group-open:rotate-90' />
        {label}
      </summary>
      <pre
        data-mono
        className='mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border border-rule bg-muted/30 p-3 text-[0.75rem] leading-relaxed text-foreground/75'
      >
        {text}
      </pre>
    </details>
  );
}

// ─── OCR status ────────────────────────────────────────────────────────────────
// One line reports the reading of a whole file — recognised / failed / pending —
// with its confidence. The transcription itself belongs to each document that
// was carved out of the file, so it is disclosed there; only while nothing has
// been carved out yet does this line carry the whole-file text (`orphan`), so
// the reading is never unreachable.
function OcrStatus({
  file,
  failed,
  orphan,
}: {
  file: SourceFileDto;
  failed: boolean;
  orphan: boolean;
}) {
  const { t } = useI18n();
  const recognised = file.pages.filter(p => p.ocr);
  const done = file.pages.length > 0 && recognised.length === file.pages.length;

  if (!done) {
    return failed ? (
      <StatusLine
        tone='fail'
        icon={<TriangleAlertIcon className='size-3' />}
        label={t('detail.ocr_failed')}
      />
    ) : (
      <StatusLine
        tone='pending'
        icon={
          <span className='size-1.5 rounded-full bg-primary motion-safe:animate-pulse' />
        }
        label={t('detail.ocr_pending')}
      />
    );
  }

  const avg =
    recognised.reduce((sum, p) => sum + (p.ocr?.confidence ?? 0), 0) /
    recognised.length;
  const text = file.pages
    .map(p => p.ocr?.text ?? '')
    .join('\n\n')
    .trim();

  return (
    <div className='min-w-0'>
      <div className='flex items-center gap-3'>
        <StatusLine
          tone='ok'
          icon={<CheckIcon className='size-3' strokeWidth={3} />}
          label={t('detail.ocr_done')}
        />
        <Confidence value={avg} />
      </div>
      {orphan && <Transcript label={t('detail.source_text')} text={text} />}
    </div>
  );
}

// ─── Page tally ───────────────────────────────────────────────────────────────
// The file's meta line doubles as the progress read-out for a long PDF: how many
// sheets it was split into, and — while the pages are still being read — how
// many have come back. It carries its own separator, because a file with nothing
// to count yet must not leave a dangling one behind.
function PageTally({ file, failed }: { file: SourceFileDto; failed: boolean }) {
  const { t } = useI18n();
  const total = file.pages.length;
  const read = file.pages.filter(p => p.ocr).length;

  // No sheets yet: a run under way is still being split, and one that failed
  // never got that far — the OCR line below is what reports that.
  if (total === 0) {
    return failed ? null : (
      <>
        {' · '}
        <span className='inline-flex items-center gap-1.5 text-primary'>
          <span
            aria-hidden
            className='size-1.5 rounded-full bg-primary motion-safe:animate-pulse'
          />
          {t('detail.splitting')}
        </span>
      </>
    );
  }

  const pages =
    total === 1 ? t('upload.page_one') : t('upload.pages', { n: total });
  // A running count earns its place only where there is a queue to watch: with a
  // single sheet, or none left unread, the total already says everything.
  if (total === 1 || read === total) return <>{` · ${pages}`}</>;

  return (
    <>
      {` · ${pages} `}
      <span aria-live='polite' className='inline-flex items-center gap-1.5'>
        {/* A failed run is not still working, so it gets the count without the
            heartbeat: 8 of 10 pages read is where it stopped. */}
        {!failed && (
          <span
            aria-hidden
            className='size-1.5 rounded-full bg-primary motion-safe:animate-pulse'
          />
        )}
        {/* Keyed on the count, so every page that lands replays the animation. */}
        <span
          key={read}
          aria-label={t('detail.pages_read', { n: read, total })}
          className={cn(
            'font-medium tabular-nums',
            failed
              ? 'text-failed-ink'
              : 'text-primary duration-300 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-75',
          )}
        >
          ({read})
        </span>
      </span>
    </>
  );
}

// ─── Extracted fields ────────────────────────────────────────────────────────
// The type's schema, filled in — read as a register, not as a form: the label
// column, then the machine-read value, then the confidence that reading carries.
// Values align down one column across every document on the page, which is what
// makes a name in the application comparable to the name on the identity card at
// a glance. Nothing is truncated; a long value wraps, because a value the
// inspector cannot read is a value they cannot verify.
const HANDWRITTEN_FRAGMENT = /\[hw:\s*([^\]]+?)\s*\]/giu;

// OCR marks handwriting in the transcription itself. Field DTOs intentionally
// stay neutral, so the report derives provenance from the source it already
// shows instead of inventing another field classification at the HTTP edge.
function isHandwritten(value: string, sourceText: string): boolean {
  const normalise = (text: string) =>
    text
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
      .replace(/\s+/g, ' ');
  const needle = normalise(value);

  if (needle.length < 2) return false;

  return [...sourceText.matchAll(HANDWRITTEN_FRAGMENT)].some(match => {
    const marked = normalise(match[1] ?? '');
    return marked.includes(needle) || needle.includes(marked);
  });
}

/**
 * Where a value the document never printed was actually read.
 *
 * A line of its own under the value rather than a chip beside it, and this is
 * the trade the row makes: the mark has to name the source document, and a
 * document type is a full sentence in all three languages — as a chip it would
 * either wrap into a block or push the value out of its column on a phone. So
 * the badge row keeps the marks that are one word and this takes the line
 * below, where the inspector gets the answer to "where is this from" without
 * leaving the screen.
 *
 * It is a link, and it points at the source document's own row for the field —
 * never at a sheet of the document it is shown under, which has none: opening
 * the wrong paper is worse than opening none (ADR-0023). The sheet in it is the
 * source's own, which is why it is read off `takenFrom` and not off the field.
 */
function TakenFrom({
  source,
  onJump,
}: {
  source: FieldSourceDto;
  onJump: Jump;
}) {
  const { t } = useI18n();
  const anchor = fieldAnchor(source.documentId, source.fieldName);

  return (
    <a
      href={anchor}
      onClick={onJump(source.documentId, anchor)}
      title={t('detail.taken_from_go')}
      className='-mx-1 mt-1 flex flex-wrap items-baseline gap-x-1.5 rounded-sm px-1 py-0.5 text-[0.6875rem] leading-snug text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
    >
      <CornerDownRightIcon
        aria-hidden
        className='size-3 shrink-0 translate-y-0.5'
      />
      <span className='min-w-0'>
        {t('detail.taken_from', {
          doc: translateOr(
            t,
            `doctype.${source.documentType}`,
            source.documentType,
          ),
        })}
      </span>
      <span className='min-w-0 text-muted-foreground/70'>
        {translateOr(t, `field.${source.fieldName}`, source.fieldName)}
        {' · '}
        {t('detail.page_single', { n: source.pageNumber })}
      </span>
    </a>
  );
}

/**
 * The marks a reading carries beside its value.
 *
 * One element rather than two loose chips, because where they sit depends on
 * what they sit after: beside a figure they belong on its line, and under a
 * value the contract asked for as a list they belong under it — a chip trailing
 * the last entry of a boundary would read as part of the boundary.
 */
function Marks({
  field,
  sourceText,
  stacked,
}: {
  field: FieldDto;
  sourceText: string;
  stacked: boolean;
}) {
  const { t } = useI18n();
  const handwritten = isHandwritten(field.value, sourceText);
  const confirmed = field.origin === 'ConfirmedByRegistry';

  if (!handwritten && !confirmed) return null;

  return (
    <span
      className={cn(
        'inline-flex flex-wrap items-center gap-2 align-middle',
        stacked ? 'mt-1' : 'ml-2',
      )}
    >
      {handwritten && (
        <span className='inline-flex rounded-sm bg-accent-2-tint px-1.5 py-0.5 text-[0.625rem] font-medium leading-none text-accent-2-ink'>
          {t('detail.handwritten')}
        </span>
      )}
      {/* The register agreed with this reading, and that is the one mark on the
          page that is a reason not to look rather than a reason to. It is set
          in the same green tick the archive panel already uses for an attribute
          that agrees, at the weight of the mark beside it: an inspector must
          not read "confirmed" as a warning (ADR-0023). */}
      {confirmed && (
        <span
          title={t('detail.confirmed_why')}
          className='inline-flex items-center gap-1 rounded-sm bg-ok/12 px-1.5 py-0.5 text-[0.625rem] font-medium leading-none text-ok-ink'
        >
          <CheckIcon className='size-2.5 shrink-0' strokeWidth={3} />
          {t('detail.confirmed')}
        </span>
      )}
    </span>
  );
}

/**
 * A value the contract asks for as a list, set as the lines it actually is.
 *
 * The boundary's turning points, the schedule of drawings, what the set is
 * composed of: the engine reads each as one field with its entries separated by
 * semicolons (COMM-78), and run together in a column sized for a cadastral
 * number they wrap into a paragraph. An inspector checking twelve turning
 * points against the sheet has to be able to run a finger down them, so the
 * separator becomes a line break and the row states the first few — the rest on
 * asking, since the whole of a twelve-point boundary under every other row is
 * the wall the card is trying not to be.
 */
function Enumerated({
  entries,
  uncertain,
}: {
  entries: readonly string[];
  uncertain: boolean;
}) {
  const { t } = useI18n();
  const [whole, setWhole] = useState(false);
  const rest = entries.length - ENTRIES_SHOWN;

  return (
    <ul
      className={cn(
        'space-y-0.5 text-[0.875rem] leading-snug',
        uncertain ? 'text-incomplete-ink' : 'text-foreground',
      )}
    >
      {(whole ? entries : entries.slice(0, ENTRIES_SHOWN)).map((entry, at) => (
        <li key={`${at}-${entry}`} className='flex gap-2'>
          <span
            aria-hidden
            className='mt-[0.55em] size-1 shrink-0 rounded-full bg-current opacity-40'
          />
          <span data-mono className='min-w-0 break-words'>
            {entry}
          </span>
        </li>
      ))}
      {rest > 0 && !whole && (
        <li>
          <button
            type='button'
            onClick={() => setWhole(true)}
            className='-mx-1 rounded-sm px-1 py-0.5 text-[0.75rem] text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
          >
            {t('detail.contents_rest', { n: rest })}
          </button>
        </li>
      )}
    </ul>
  );
}

function Field({
  field,
  docId,
  sourceText,
  folded,
  spent,
  onJump,
}: {
  field: FieldDto;
  docId: string;
  sourceText: string;
  /** Whether the paper this was read off has been replaced. A doubtful reading
   *  on a document out of force keeps its figure and loses the "needs review"
   *  chip: the figure is what was read, which stays true, and the chip is an
   *  instruction to go and settle something the case no longer rests on. */
  spent: boolean;
  folded: boolean;
  onJump: Jump;
}) {
  const { t } = useI18n();
  const entries = entriesOf(field.value);
  const uncertain = field.confidence < CONFIDENCE_FLOOR;

  return (
    <div
      // The worklist's landing point. `target:` washes the row in the
      // register's own selection tint so a jump from the finding arrives on
      // a row the eye can find, and the wash fades rather than sticking.
      id={fieldRowId(docId, field.name)}
      className={cn(
        'grid scroll-mt-16 grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-4 gap-y-1 border-b border-rule py-2.5 transition-colors duration-500 target:bg-accent @md:grid-cols-[minmax(8rem,15rem)_minmax(0,1fr)_auto] @md:gap-x-6 @md:gap-y-0',
        // A folded row keeps its place in the document and answers to its own
        // fragment: `:target` outranks `hidden`, so the one row a finding names
        // opens itself as the hash lands and before the browser scrolls to it.
        // Folding it in React instead would hide it from the browser at the
        // moment of the jump, and the finding would land near its evidence.
        folded && 'hidden target:grid',
      )}
    >
      <dt className='col-span-2 text-[0.8125rem] leading-snug text-muted-foreground @md:col-span-1'>
        {translateOr(t, `field.${field.name}`, field.name)}
      </dt>
      <dd className='min-w-0'>
        {entries.length > 0 ? (
          <Enumerated entries={entries} uncertain={uncertain} />
        ) : (
          <span
            data-mono
            className={cn(
              'break-words whitespace-pre-line text-[0.875rem] leading-snug',
              uncertain ? 'text-incomplete-ink' : 'text-foreground',
            )}
          >
            {/* A field the paper does not carry keeps its row and says so. It
                is an answer the inspector needs — there was nothing there and
                nowhere to take it from — and a row that vanished would read as
                a field nobody asked for. */}
            {field.value || '—'}
          </span>
        )}
        <Marks
          field={field}
          sourceText={sourceText}
          stacked={entries.length > 0}
        />
        {field.takenFrom && (
          <TakenFrom source={field.takenFrom} onJump={onJump} />
        )}
      </dd>
      {/* A carried-over reading keeps its figure and loses the chip: "needs
          review" is the worklist's own word for a sheet that wants a second
          look, and the report deliberately files no finding against this
          one — the line under the value says where to look instead. */}
      <Confidence
        value={field.confidence}
        bare={isCarriedOver(field) || spent}
      />
    </div>
  );
}

function Fields({
  fields,
  docId,
  sourceText,
  spent,
  onJump,
}: {
  fields: FieldDto[];
  docId: string;
  sourceText: string;
  /** Whether this paper has been replaced — see `Field`. */
  spent: boolean;
  onJump: Jump;
}) {
  const { t } = useI18n();
  const { shown, folded } = foldFields(fields);
  const [whole, setWhole] = useState(() =>
    holdsHash(folded, docId, window.location.hash),
  );
  // What the fold is keeping back that the inspector was sent here for. The
  // same rule the heading counts by: only a reading made on this paper is work
  // on this paper (ADR-0023).
  const flagged = fieldsReadHere(folded).filter(
    field => field.confidence < CONFIDENCE_FLOOR,
  ).length;

  return (
    <>
      {/* A container and not the viewport: how much room a row has is decided
          by the rail beside the register and by the sheets column beside the
          card, not by how wide the window is. At 1280 those two take enough
          that a three-column row leaves the value about a hundred pixels — a
          registry number set one digit per line — while the same window at
          1440 has room to spare. The row asks the card. */}
      <dl className='@container mt-3 border-t border-rule'>
        {shown.map(field => (
          <Field
            key={field.name}
            field={field}
            docId={docId}
            sourceText={sourceText}
            folded={false}
            spent={spent}
            onJump={onJump}
          />
        ))}
        {folded.map(field => (
          <Field
            key={field.name}
            field={field}
            docId={docId}
            sourceText={sourceText}
            folded={!whole}
            spent={spent}
            onJump={onJump}
          />
        ))}
      </dl>
      {folded.length > 0 && (
        <button
          type='button'
          aria-expanded={whole}
          onClick={() => setWhole(open => !open)}
          className='-mx-1 mt-2 flex items-center gap-1.5 rounded-sm px-1 py-0.5 text-[0.75rem] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
        >
          <ChevronRightIcon
            aria-hidden
            className={cn(
              'size-3.5 shrink-0 transition-transform',
              whole && 'rotate-90',
            )}
          />
          {whole
            ? t('detail.fields_fold')
            : t('detail.fields_more', { n: folded.length })}
          {/* A fold that swallowed the doubtful readings would answer the
              heading's count with rows nobody can see, so it says how many of
              them are down there. */}
          {!whole && flagged > 0 && !spent && (
            <span
              data-mono
              title={t('detail.fields_more_review', { n: flagged })}
              className='rounded-full bg-incomplete/12 px-1.5 py-0.5 text-[0.6875rem] font-medium tabular-nums text-incomplete-ink'
            >
              {flagged}
            </span>
          )}
        </button>
      )}
    </>
  );
}

// ─── One document found inside a file ────────────────────────────────────────
// A file is a container, so a document is identified by where it sits in that
// container — the sheets it occupies — not by a filename of its own.
function pageLabel(t: Translate, doc: DocumentDto): string {
  return doc.firstPage === doc.lastPage
    ? t('detail.page_single', { n: doc.firstPage })
    : t('detail.page_range', { from: doc.firstPage, to: doc.lastPage });
}

/** The document's own sheets, read out — the evidence its fields were taken
 *  from, so provenance sits one line below the value it produced. */
function documentText(doc: DocumentDto, file: SourceFileDto): string {
  return file.pages
    .filter(p => p.pageNumber >= doc.firstPage && p.pageNumber <= doc.lastPage)
    .map(p => p.ocr?.text ?? '')
    .join('\n\n')
    .trim();
}

// ─── The sheets themselves ────────────────────────────────────────────────────
// Everything else on this page is the machine's account of the scan; this is the
// scan. A value the inspector cannot check against the paper is a value they
// have to take on trust, which is the one thing this surface exists not to ask
// of them. Thumbnails, because the point is to find the right sheet quickly —
// the sheet itself opens full size in its own tab.
function Sheets({ doc, file }: { doc: DocumentDto; file: SourceFileDto }) {
  const { t } = useI18n();
  const sheets = file.pages.filter(
    page =>
      page.pageNumber >= doc.firstPage &&
      page.pageNumber <= doc.lastPage &&
      page.imageUrl,
  );

  if (sheets.length === 0) return null;

  return (
    // Rides in the entry's side column from `lg` up, so the paper sits level
    // with the values taken off it — a reading and its evidence on one line of
    // sight, instead of the reading here and the scan three hundred pixels
    // below it. Below `lg` it falls back under the fields, where the column
    // would be too narrow to show anything.
    // No heading: sixteen entries each captioned "Sheets" is the same repetition
    // this surface was buried under, and a column of scans needs no label.
    <div className='mt-4 lg:mt-0'>
      <ul className='flex flex-wrap gap-2'>
        {sheets.map(page => (
          <li key={page.pageNumber}>
            <a
              href={page.imageUrl ?? undefined}
              target='_blank'
              rel='noreferrer'
              title={t('detail.page_single', { n: page.pageNumber })}
              className='group block w-[5.25rem] overflow-hidden rounded-md border border-rule transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
            >
              <img
                src={page.imageUrl ?? undefined}
                alt={t('detail.page_single', { n: page.pageNumber })}
                loading='lazy'
                // A tall crop of the head of the sheet: a scanned form says what
                // it is in its first inch, and a whole A4 shrunk to 80px says
                // nothing at all.
                className='h-28 w-full bg-background object-cover object-top'
              />
              <span
                data-mono
                className='block border-t border-rule px-1 py-0.5 text-center text-[0.625rem] tabular-nums text-muted-foreground group-hover:text-foreground'
              >
                {page.pageNumber}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── The seal and the hand that signed ───────────────────────────────────────
// Drawn on every placed document and in every state, which is the whole point:
// before this the surface only ever spoke about a mark when one the profile
// wanted was missing, so "sealed", "not sealed" and "no sheet of this was ever
// read" all reached the inspector as the same thing — nothing (COMM-77).
//
// It sits directly under the document's own title rather than below the field
// register, because it is a statement about the paper and not one of the values
// read off it, and because presence has to be as findable as a shortfall. Two
// short lines is what that costs on every entry, and it is worth it.
//
// A glyph and a sentence, never colour alone — the same rule the rest of the
// surface marks state by.
const MARK_ICON: Record<MarkStanding, typeof CheckIcon> = {
  carried: CheckIcon,
  short: TriangleAlertIcon,
  bare: MinusIcon,
  unread: EyeOffIcon,
};

const MARK_INK: Record<MarkStanding, string> = {
  carried: 'text-ok-ink',
  // The clay the whole surface doubts in, and deliberately not the red a
  // failure is drawn in: the report already files this same observation as a
  // finding in the list above, and one thing seen once should not be alarmed
  // about twice.
  short: 'text-incomplete-ink',
  bare: 'text-muted-foreground/60',
  unread: 'text-muted-foreground',
};

function Attestation({
  attestation,
}: {
  attestation: DocumentAttestationDto | null;
}) {
  const { t } = useI18n();
  const lines = attestationLines(attestation);

  if (lines.length === 0) return null;

  return (
    <ul className='mt-2.5 flex flex-col gap-1'>
      {lines.map(line => {
        const Icon = MARK_ICON[line.standing];
        const unread = line.standing === 'unread';

        return (
          <li
            key={line.kind}
            title={unread ? t('attest.unread_why') : undefined}
            className={cn(
              'flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[0.8125rem] leading-snug',
              // Nothing was looked at, so the line is drawn as a gap in the
              // record and not as a reading of the paper: a dashed rule down
              // its side and the sentence set apart in italic. If this ever
              // reads like "the mark is missing", the screen is handing an
              // inspector a guess in place of an observation.
              unread && 'border-l-2 border-dashed border-rule pl-2.5',
            )}
          >
            <Icon
              aria-hidden
              className={cn(
                'size-3.5 shrink-0 translate-y-0.5',
                MARK_INK[line.standing],
              )}
              strokeWidth={line.standing === 'carried' ? 3 : 2}
            />
            <span className='shrink-0 text-muted-foreground'>
              {t(line.label)}
            </span>
            <span
              className={cn(
                'min-w-0',
                unread ? 'italic text-muted-foreground' : 'text-foreground',
              )}
            >
              {t(line.key)}
            </span>
            {/* What the seal actually says, when it could be read — the
                difference between "this paper is sealed" and "this paper is
                sealed by the committee that may seal it". */}
            {line.legends.length > 0 && (
              <span
                data-mono
                title={t('attest.legend')}
                className='min-w-0 break-words text-[0.75rem] text-muted-foreground'
              >
                “{line.legends.join(' · ')}”
              </span>
            )}
            {/* Read off sheets the engine itself doubts, so the figure goes
                beside the sentence — an uncertain reading must not be set down
                as a fact (PRD §4.6). Bare: the "needs review" chip is the
                worklist's own word, counted per field in the heading above, and
                a second one here would inflate a count it is not part of. */}
            {line.confidence !== null && line.confidence < CONFIDENCE_FLOOR && (
              <span className='ml-auto'>
                <Confidence value={line.confidence} bare />
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * A paper the package no longer rests on, kept where it always was.
 *
 * A replaced scan is never removed: a submission is evidence and not a working
 * draft, so what was sent first stays readable, saying what replaced it and on
 * what day (COMM-80). Drawn as history — muted, stamped, its figures out of the
 * argument — because the one thing worse than hiding it would be leaving it
 * looking like a paper the case is still decided on.
 */
function SupersededMark({
  doc,
  files,
  onJump,
}: {
  doc: DocumentDto;
  files: readonly SourceFileDto[];
  onJump: Jump;
}) {
  const { t, locale } = useI18n();
  const replacement = documentIn(files, doc.supersededById);
  const when = doc.supersededAt ? formatDate(doc.supersededAt, locale) : '';

  return (
    <p className='mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[0.75rem] text-muted-foreground'>
      <span className='inline-flex items-center gap-1.5 rounded-full bg-muted px-2 py-0.5 font-medium uppercase tracking-[0.08em] text-muted-foreground'>
        <HistoryIcon aria-hidden className='size-3' />
        {t('detail.superseded')}
      </span>
      <span>{when ? t('detail.superseded_on', { date: when }) : ''}</span>
      {/* Null where the replacement has since gone with its own file: the stamp
          is what says this document is out of force, not the pointer. */}
      {replacement && (
        <a
          href={`#doc-${replacement.document.id}`}
          onClick={onJump(
            replacement.document.id,
            `#doc-${replacement.document.id}`,
          )}
          className='text-primary underline-offset-2 hover:underline'
        >
          {t('detail.superseded_by', {
            file: replacement.file.originalFilename,
          })}
        </a>
      )}
    </p>
  );
}

function DocumentEntry({
  doc,
  file,
  files,
  onJump,
}: {
  doc: DocumentDto;
  file: SourceFileDto;
  /** Every file of the package, so a replaced scan can name the one that
   *  replaced it — which lives under a different file than this one. */
  files: readonly SourceFileDto[];
  onJump: Jump;
}) {
  const { t } = useI18n();
  const spent = isSuperseded(doc);
  // Two different answers that both leave a document without fields, and they
  // must not read alike: "we could not tell what this is" against "we read it,
  // and the statutory list does not name it".
  const unclassified = doc.type === 'unknown';
  const outOfProfile = doc.type === 'out_of_profile';
  const fieldless = unclassified || outOfProfile;
  const text = documentText(doc, file);
  // Either way there are no fields to show, so a one-line preview off the
  // document's own sheets tells the inspector roughly what is there.
  const snippet = fieldless ? text.replace(/\s+/g, ' ').slice(0, 160) : '';
  // The same rule the segments count by: only a reading made on this paper is
  // work on this paper (ADR-0023).
  const flagged = fieldsReadHere(doc.fields).filter(
    f => f.confidence < CONFIDENCE_FLOOR,
  ).length;
  // A confidence the engine is sure of is a figure nobody reads. It is kept
  // where it can be checked — on the fields — and dropped from the heading
  // unless the heading is where the doubt is.
  const headline =
    doc.classificationConfidence != null &&
    doc.classificationConfidence < CONFIDENCE_FLOOR
      ? doc.classificationConfidence
      : null;

  return (
    // Values left, the paper they were read off right — the heading sits in the
    // values column so its confidence lands in the values column too, and the
    // sheets start level with the document's own title.
    <article
      id={`doc-${doc.id}`}
      className={cn(
        'scroll-mt-16 py-6 first:pt-5 last:pb-0 lg:grid lg:grid-cols-[minmax(0,1fr)_11.5rem] lg:gap-x-8',
        spent && 'opacity-70',
      )}
    >
      <div className='min-w-0'>
        <header className='flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1'>
          <div className='flex min-w-0 items-baseline gap-3'>
            <span
              data-mono
              className='shrink-0 text-[0.75rem] tabular-nums text-muted-foreground'
            >
              {pageLabel(t, doc)}
            </span>
            {doc.type ? (
              <h3
                className={cn(
                  'text-[0.9375rem] font-[550] leading-tight tracking-[-0.01em]',
                  fieldless || spent
                    ? 'text-muted-foreground'
                    : 'text-foreground',
                  spent && 'line-through decoration-rule-strong',
                )}
              >
                {translateOr(t, `doctype.${doc.type}`, doc.type)}
              </h3>
            ) : (
              <span className='flex items-center gap-1.5 text-[0.8125rem] font-medium text-primary'>
                <span
                  aria-hidden
                  className='size-1.5 rounded-full bg-primary motion-safe:animate-pulse'
                />
                {t('detail.classifying')}
              </span>
            )}
            {/* How many readings in this document want a second look — the count
              the worklist above sent the inspector here for, restated where the
              work is. Silent when there is nothing to check. */}
            {flagged > 0 && !spent && (
              <span
                data-mono
                className='shrink-0 rounded-full bg-incomplete/12 px-1.5 py-0.5 text-[0.6875rem] font-medium tabular-nums text-incomplete-ink'
              >
                {flagged}
              </span>
            )}
          </div>
          {headline != null && (
            // Pushed right on its own line when the type name takes the full
            // width, so a wrapped confidence still lands in its column.
            <span className='ml-auto'>
              <Confidence value={headline} />
            </span>
          )}
        </header>

        {spent && <SupersededMark doc={doc} files={files} onJump={onJump} />}

        <Attestation attestation={doc.attestation} />

        {fieldless ? (
          <p className='mt-2 max-w-[65ch] text-[0.8125rem] leading-relaxed text-muted-foreground'>
            {outOfProfile
              ? t('detail.out_of_profile')
              : t('detail.unclassified')}
            {snippet && (
              <span className='mt-1.5 block text-[0.75rem] italic text-foreground/55'>
                “{snippet}…”
              </span>
            )}
          </p>
        ) : (
          doc.fields.length > 0 && (
            <Fields
              fields={doc.fields}
              docId={doc.id}
              sourceText={text}
              spent={spent}
              onJump={onJump}
            />
          )
        )}

        {/* The machine's account of the same sheets the column beside it
            shows, so it stays under the values it explains. */}
        {text && (
          <Transcript
            label={`${t('detail.source_text')} · ${pageLabel(t, doc)}`}
            text={text}
          />
        )}
      </div>

      <Sheets doc={doc} file={file} />
    </article>
  );
}

// ─── The documents the profile has nothing to ask of ─────────────────────────
// Eight of the sixteen documents in a package like this one are the registry's
// own service sheets: read, placed, and not asked for. Spelled out they are the
// largest thing on the page and the least actionable, so they fold into one
// line that says how many there are and which sheets they sit on. Nothing is
// lost — the line opens.
function AsideGroup({
  docs,
  file,
  files,
  onJump,
}: {
  docs: DocumentDto[];
  file: SourceFileDto;
  files: readonly SourceFileDto[];
  onJump: Jump;
}) {
  const { t } = useI18n();
  if (docs.length === 0) return null;

  return (
    <details className='group'>
      <summary className='flex cursor-pointer list-none select-none items-baseline gap-3 py-3.5 text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50'>
        <ChevronRightIcon className='size-3.5 shrink-0 translate-y-0.5 transition-transform duration-200 group-open:rotate-90' />
        <span className='min-w-0'>
          {docs.length === 1
            ? t('detail.other_group_one')
            : t('detail.other_group', { n: docs.length })}
        </span>
        <span
          data-mono
          className='ml-auto shrink-0 text-[0.6875rem] tabular-nums text-muted-foreground/70'
        >
          {docs.map(doc => pageLabel(t, doc).replace(/^\D+/, '')).join(', ')}
        </span>
      </summary>
      <div className='divide-y divide-rule border-t border-rule'>
        {docs.map(doc => (
          <DocumentEntry
            key={doc.id}
            doc={doc}
            file={file}
            files={files}
            onJump={onJump}
          />
        ))}
      </div>
    </details>
  );
}

/**
 * What a file was sent in to answer, where it was sent in for one.
 *
 * Null on every file the submission was made with and on every one added in
 * bulk: those are the envelope, and nothing about them claims to fill a
 * particular hole (COMM-80). Stated on the file and not on the documents under
 * it, because the target was given for the file — before anything had read it,
 * and whatever the reader went on to make of it.
 */
function SuppliedFor({
  file,
  files,
}: {
  file: SourceFileDto;
  files: readonly SourceFileDto[];
}) {
  const { t } = useI18n();
  const target = file.suppliedFor;
  if (!target) return null;

  const type = translateOr(
    t,
    `doctype.${target.expectedType}`,
    target.expectedType,
  );
  const replaced = documentIn(files, target.replacesDocumentId);

  return (
    <p className='mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.75rem] text-muted-foreground'>
      <span className='inline-flex items-center gap-1.5 rounded-full bg-accent/60 px-2 py-0.5 font-medium uppercase tracking-[0.08em] text-accent-foreground'>
        <CornerDownRightIcon aria-hidden className='size-3' />
        {t('detail.supplied')}
      </span>
      <span>
        {replaced
          ? t('detail.supplied_replacing', {
              type,
              file: replaced.file.originalFilename,
            })
          : t('detail.supplied_for', { type })}
      </span>
    </p>
  );
}

// ─── One uploaded file ───────────────────────────────────────────────────────
// The provenance line for the documents beneath it: what the inspector attached,
// how many sheets it was split into, and whether those sheets were read. With
// one file it reads as a caption; with several it becomes the rule that groups
// each file's documents.
function FileGroup({
  file,
  files,
  failed,
  segment,
  onJump,
}: {
  file: SourceFileDto;
  /** Every file of the package: a document replaced by one sent in later names
   *  its replacement, and the replacement lives under a different file. */
  files: readonly SourceFileDto[];
  failed: boolean;
  segment: DocSegment;
  onJump: Jump;
}) {
  const { t } = useI18n();
  const Icon = file.contentType.startsWith('image/') ? ImageIcon : FileTextIcon;
  const read = file.pages.length > 0 && file.pages.every(p => p.ocr !== null);
  const found = file.documents.length;
  const detecting = found === 0 && read && !failed;
  const shown = file.documents.filter(doc => inSegment(doc, segment));
  // Under "all" the register still reads down the file in sheet order — the
  // service sheets keep their place in the sequence, folded into the line that
  // stands for them rather than spelled out. Under a segment that is already a
  // filter, folding a second time would just hide the answer.
  const folded = segment === 'all';
  const listed = folded ? shown.filter(doc => !isAside(doc)) : shown;
  const asides = folded ? shown.filter(isAside) : [];
  // The rule under the file line divides it from what it holds. A file that
  // holds nothing — a run that failed before detection — gets no divider, so the
  // section never ends on a hairline with nothing beneath it.
  const holds = found > 0 || detecting;

  return (
    <section>
      <div
        className={cn(
          'flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2',
          holds && 'border-b border-rule-strong pb-3',
        )}
      >
        <div className='flex min-w-0 items-baseline gap-2.5'>
          <Icon
            aria-hidden
            className='size-4 shrink-0 translate-y-0.5 text-muted-foreground'
          />
          <h2 className='truncate text-[0.9375rem] font-semibold text-foreground'>
            {file.originalFilename}
          </h2>
          <span
            data-mono
            className='shrink-0 text-[0.6875rem] text-muted-foreground'
          >
            {file.contentType}
            <PageTally file={file} failed={failed} />
          </span>
        </div>
        <OcrStatus file={file} failed={failed} orphan={found === 0} />
      </div>

      <SuppliedFor file={file} files={files} />

      {found > 0 ? (
        shown.length === 0 ? (
          <p className='py-5 text-[0.8125rem] text-muted-foreground'>
            {t('detail.empty_filter')}
          </p>
        ) : (
          <div className='divide-y divide-rule'>
            {listed.map(doc => (
              <DocumentEntry
                key={doc.id}
                doc={doc}
                file={file}
                files={files}
                onJump={onJump}
              />
            ))}
            <AsideGroup
              docs={asides}
              file={file}
              files={files}
              onJump={onJump}
            />
          </div>
        )
      ) : (
        // The sheets are read but nothing has been carved out of them yet: the
        // file is still being split into the documents it holds.
        detecting && (
          <span className='mt-4 flex items-center gap-1.5 text-[0.8125rem] text-primary'>
            <span
              aria-hidden
              className='size-1.5 rounded-full bg-primary motion-safe:animate-pulse'
            />
            {t('detail.detecting')}
          </span>
        )
      )}
    </section>
  );
}

// ─── The report ───────────────────────────────────────────────────────────────
// The last thing every run produces, and the only thing the operator is
// promised: a run is never stopped by a document it could not read, so whatever
// the engine met is stated here and handed over. It reports; the inspector
// decides.
// In the order an inspector works down them: what the package is short of,
// where its documents contradict each other, what could not be read, what was
// read but should be checked, and last — under its own heading, because it is
// not a fault — what else was in the envelope.
//
// One record over the whole published enum, in the order the sections are
// shown: a `Record<IssueKind, …>` will not compile while a kind is missing, so
// a finding the contract has learned to produce cannot quietly fail to appear.
// It used to be three parallel arrays, and the day the register stage added two
// kinds they rendered in no section at all while the counter still counted one
// of them — the report said "1 finding" over an empty list.
//
// `tone` is also the only definition of what counts: an observation is not a
// shortfall, so a report that notes the registry's own service sheets must not
// announce five problems. Deriving the count from here is what keeps the client
// from disagreeing with the server about which kinds are informational.
//
// Three tones and not two, because there are three things a report says and
// they are told apart here or nowhere: what is wrong with the package
// (`finding`), what was in the envelope beyond it (`note`), and what has to be
// brought next for the case it turned out to be (`requirement`). The third
// counts against nothing — like a note — and is not folded away with the notes
// either: it is the only line the applicant has to act on (ADR-0013).
type SectionTone = 'finding' | 'note' | 'requirement';

//
// The headings themselves are the entity's `ISSUE_KIND_KEY` and not literals
// here: the register's summary ranks the same kinds by how often they come up,
// and a kind named one thing on a package and another in a tally of a hundred
// of them is two vocabularies for one idea. What stays local is the `tone` —
// which of the three things a report says this kind is — because that is this
// page's own classification and no other screen reads it.
const SECTIONS: Record<IssueKind, { heading: string; tone: SectionTone }> = {
  MissingDocument: { heading: ISSUE_KIND_KEY.MissingDocument, tone: 'finding' },
  FieldMismatch: { heading: ISSUE_KIND_KEY.FieldMismatch, tone: 'finding' },
  // Beside the papers disagreeing with each other, because it is the same
  // question asked of a different source: the record of what was registered.
  RegistryMismatch: {
    heading: ISSUE_KIND_KEY.RegistryMismatch,
    tone: 'finding',
  },
  // A finding and not an observation, unlike an absent record: the archive
  // wrote down that it does not have the original, and for a title relied on
  // under Decree 439 the original is a condition of the ground (ADR-0010).
  RegistryDocumentMissing: {
    heading: ISSUE_KIND_KEY.RegistryDocumentMissing,
    tone: 'finding',
  },
  // Beside the other shortfalls in the package itself and before the reading
  // ones: the sheet was read perfectly well, and what it was read to hold is a
  // paper without the seal or the hand that makes it valid (ADR-0012).
  MissingAttestation: {
    heading: ISSUE_KIND_KEY.MissingAttestation,
    tone: 'finding',
  },
  UnreadableDocument: {
    heading: ISSUE_KIND_KEY.UnreadableDocument,
    tone: 'finding',
  },
  LowConfidence: { heading: ISSUE_KIND_KEY.LowConfidence, tone: 'finding' },
  DuplicateDocument: {
    heading: ISSUE_KIND_KEY.DuplicateDocument,
    tone: 'note',
  },
  ExtraDocument: { heading: ISSUE_KIND_KEY.ExtraDocument, tone: 'note' },
  // An observation and never a fault: the archive register holds the
  // privatisations of the 1990s and 2000s, so it having no record of a property
  // says nothing about the submission (ADR-0009).
  RegistryUnconfirmed: {
    heading: ISSUE_KIND_KEY.RegistryUnconfirmed,
    tone: 'note',
  },
  // An observation and never a fault: one side of it was typed by the office at
  // the counter and the other read off a scan, either can be wrong, and the
  // applicant wrote neither. The inspector settles it by opening the sheet the
  // finding is filed against.
  DeclaredValueMismatch: {
    heading: ISSUE_KIND_KEY.DeclaredValueMismatch,
    tone: 'note',
  },
  // A shortfall in the package and beside the others: a file was sent in to
  // close one of these very sections and turned out to be a different paper, so
  // the section it was answering is still here and this says why (COMM-80).
  WrongDocumentSupplied: {
    heading: ISSUE_KIND_KEY.WrongDocumentSupplied,
    tone: 'finding',
  },
  // Neither a fault nor an observation about the envelope: what the applicant
  // has to bring next, for the case this package turned out to be. Last,
  // because it is the only line that is about what happens after the report
  // (ADR-0013).
  SupportingDocumentsRequired: {
    heading: ISSUE_KIND_KEY.SupportingDocumentsRequired,
    tone: 'requirement',
  },
};

const ORDERED = Object.entries(SECTIONS) as [
  IssueKind,
  { heading: string; tone: SectionTone },
][];

const ISSUE_SECTIONS = ORDERED.filter(
  ([, section]) => section.tone === 'finding',
);
const NOTE_SECTIONS = ORDERED.filter(([, section]) => section.tone === 'note');

/** Whether a line of this kind is held against the package. The report's own
 *  rule, and the only place the client states it: what is counted in the
 *  conclusion, in the tab's badge and in the worklist all read it. */
const countsAgainstPackage = (kind: IssueKind): boolean =>
  SECTIONS[kind].tone === 'finding';

/** What the envelope carried beyond the profile's list. Folded away by default,
 *  which is why what has to be brought next may not join it. */
const isObservation = (kind: IssueKind): boolean =>
  SECTIONS[kind].tone === 'note';

// Archive answers have their own comparison surface below. Keeping them out of
// the package worklist prevents the same disagreement being explained twice,
// once without the archived value and once with it.
const isArchiveFinding = (kind: IssueKind): boolean =>
  kind === 'RegistryMismatch' ||
  kind === 'RegistryDocumentMissing' ||
  kind === 'RegistryUnconfirmed';

// The three tones a cross-document check reports in: settled, a fault, and
// neither of the two. The archive panel draws two more of its own — the
// register is a source outside the system and is allowed not to know — so the
// whole vocabulary lives with the entity that owns the mark.
type Tone = 'ok' | 'issues' | 'incomplete';

type Finding = {
  subject: string;
  where: string;
  anchor: string | null;
  docId: string | null;
};

/* A click on a worklist or index row takes the `Jump` the shared layer
 * declares. It is one type and not one per surface because the gaps panel hands
 * this page's handler back to it, and two identical declarations of a function
 * type are two types to the compiler. */

/** What a finding is about, in the reader's own language, and where in the
 *  register it can be answered. The wire carries the English audit line;
 *  nothing here reads it.
 *
 *  `named` is false for a single-file package: printing a fifty-character
 *  filename on every row of a list that is all one file states nothing and
 *  crowds out the page number, which is the part the inspector navigates by. */
function findingOf(
  t: Translate,
  issue: IssueDto,
  pkg: PackageDetailDto,
  named: boolean,
): Finding {
  const file = pkg.files.find(candidate => candidate.id === issue.sourceFileId);
  const filename = named ? file?.originalFilename : undefined;
  const document = documentsOf(pkg).find(
    candidate => candidate.id === issue.documentId,
  );
  const sheet =
    issue.pageNumber === null
      ? ''
      : t('detail.page_single', { n: issue.pageNumber });
  const within = [filename, sheet].filter(Boolean).join(' · ');
  // The exact row the finding is about, so the list is a set of jumps into the
  // register rather than a second account of it. A field is addressed by name;
  // anything else lands on its document. A missing document has no evidence to
  // land on — it is the one finding with nowhere to go.
  const anchor = document
    ? issue.fieldName
      ? fieldAnchor(document.id, issue.fieldName)
      : `#doc-${document.id}`
    : null;

  if (issue.kind === 'MissingDocument') {
    return {
      subject: translateOr(
        t,
        `doctype.${issue.documentType}`,
        issue.documentType ?? '',
      ),
      where: t('detail.f.missing_sub'),
      anchor: null,
      docId: null,
    };
  }

  // A disagreement is about a rule, not about a field: it is named by the
  // check, and it is answered in the cross-document panel, where both sides of
  // it are on one line — not on the one field the finding happens to be filed
  // against.
  if (issue.kind === 'FieldMismatch') {
    const check = pkg.crossChecks.find(
      candidate => candidate.key === issue.checkKey,
    );

    return {
      subject: translateOr(t, `check.${issue.checkKey}`, issue.checkKey ?? ''),
      where:
        check?.verdict === 'Unclear'
          ? t('detail.f.unclear_sub')
          : t('detail.f.mismatch_sub'),
      anchor: issue.checkKey ? `#check-${issue.checkKey}` : null,
      docId: null,
    };
  }

  if (issue.kind === 'UnreadableDocument') {
    if (document) {
      return {
        subject: [pageLabel(t, document), filename].filter(Boolean).join(' · '),
        where: t('detail.f.unplaced_sub'),
        anchor,
        docId: document.id,
      };
    }
    return {
      subject: within || t('detail.files'),
      where:
        issue.pageNumber === null
          ? t('detail.f.unread_file_sub')
          : t('detail.f.unread_sheet_sub'),
      anchor,
      docId: null,
    };
  }

  /*
   * What the archive register said about the property. It is named by the value
   * that was looked up — the address the application is made under — and
   * answered on the sheet that value was read off, because that is where the
   * inspector sees what the package claims. What the record says instead is not
   * printed here: the row is a jump into the register, and the English audit
   * line is not a sentence to show anybody (ADR-0009).
   */
  if (
    issue.kind === 'RegistryMismatch' ||
    issue.kind === 'RegistryDocumentMissing' ||
    issue.kind === 'RegistryUnconfirmed'
  ) {
    return {
      // A missing original is about the paper and not about a value on it, so
      // it is named by the document even where a field was read.
      subject:
        issue.fieldName && issue.kind !== 'RegistryDocumentMissing'
          ? translateOr(t, `field.${issue.fieldName}`, issue.fieldName)
          : translateOr(
              t,
              `doctype.${issue.documentType}`,
              issue.documentType ?? '',
            ),
      where:
        issue.kind === 'RegistryMismatch'
          ? t('detail.f.registry_mismatch_sub')
          : issue.kind === 'RegistryDocumentMissing'
            ? t('detail.f.registry_document_missing_sub')
            : t('detail.f.registry_unconfirmed_sub'),
      anchor,
      docId: document?.id ?? null,
    };
  }

  /*
   * What the office declared, against what the papers turned out to say.
   *
   * The finding is filed against the reading — that is the sheet an inspector
   * settles it on — and the figure it disagrees with is on no sheet at all, so
   * the row carries it: without the declared year beside it the line says two
   * figures differ and shows one of them. It is named by the field the year was
   * read off, like every other row about a reading, and it is stated as
   * declared rather than as read.
   */
  if (issue.kind === 'DeclaredValueMismatch') {
    return {
      subject: issue.fieldName
        ? translateOr(t, `field.${issue.fieldName}`, issue.fieldName)
        : translateOr(
            t,
            `doctype.${issue.documentType}`,
            issue.documentType ?? '',
          ),
      where: [
        pkg.declared.builtYear === null
          ? t('detail.f.declared_sub')
          : t('detail.f.declared_year_sub', { year: pkg.declared.builtYear }),
        within,
      ]
        .filter(Boolean)
        .join(' · '),
      anchor,
      docId: document?.id ?? null,
    };
  }

  // A paper the profile expects an office to have sealed or signed, and the
  // reading found no such mark on it. Named by its type, because the question
  // is about the document and not about a value on it; which of the two marks
  // is absent stays in the English audit line, and the row jumps to the sheets
  // the inspector settles it on.
  if (issue.kind === 'MissingAttestation') {
    return {
      subject: translateOr(
        t,
        `doctype.${issue.documentType}`,
        issue.documentType ?? '',
      ),
      where: [t('detail.f.attestation_sub'), within]
        .filter(Boolean)
        .join(' · '),
      anchor,
      docId: document?.id ?? null,
    };
  }

  // What the applicant must bring beyond the envelope is not a finding and does
  // not appear in this list at all: it has a panel of its own, below the
  // worklist, where it can be read as an instruction rather than as a row in a
  // register of faults (`SupportingDocuments`, ADR-0013).

  // A document that read perfectly well. It is named by where it sits, and the
  // sub-line says what it is — not in the profile, or a second answer to a type
  // the package had already answered.
  // A file sent in for a published gap that turned out to be a different paper.
  // The subject is what was asked for, because that is the gap still open — and
  // the sub-line names what turned up instead, since the operator's next move
  // depends on which of the two went wrong. The finding carries the expected
  // type, so what arrived is read off the document it was filed against.
  if (issue.kind === 'WrongDocumentSupplied') {
    const arrived =
      document?.type === null ||
      document?.type === undefined ||
      document.type === 'unknown'
        ? t('gap.arrived_unplaced')
        : translateOr(t, `doctype.${document.type}`, document.type);

    return {
      subject: translateOr(
        t,
        `doctype.${issue.documentType}`,
        issue.documentType ?? '',
      ),
      where: t('detail.f.wrong_supplied_sub', {
        file: filename ?? file?.originalFilename ?? t('detail.files'),
        arrived,
      }),
      anchor,
      docId: document?.id ?? null,
    };
  }

  if (issue.kind === 'ExtraDocument' || issue.kind === 'DuplicateDocument') {
    // An extra document the catalogue recognised carries its own key rather
    // than "out_of_profile", and then the sub-line can say what the paper is
    // instead of only what it is not (ADR-0012).
    const named =
      issue.documentType !== null && issue.documentType !== 'out_of_profile';
    const where =
      issue.kind === 'ExtraDocument'
        ? named
          ? t('detail.f.extra_named_sub', {
              type: translateOr(
                t,
                `doctype.${issue.documentType}`,
                issue.documentType ?? '',
              ),
            })
          : t('detail.f.extra_sub')
        : t('detail.f.duplicate_sub', {
            type: translateOr(
              t,
              `doctype.${issue.documentType}`,
              issue.documentType ?? '',
            ),
          });

    return {
      subject: document
        ? [pageLabel(t, document), filename].filter(Boolean).join(' · ')
        : within || t('detail.files'),
      where,
      anchor,
      docId: document?.id ?? null,
    };
  }

  // Low confidence: the field is the subject, and the sheet it was read off is
  // where the inspector goes to settle it. A finding about the document as a
  // whole carries no sheet of its own, so it takes the document's — without it
  // a package holding two applications states the same finding twice with
  // nothing to tell the two apart.
  const seat = document
    ? [pageLabel(t, document), filename].filter(Boolean).join(' · ')
    : '';
  return {
    subject: issue.fieldName
      ? translateOr(t, `field.${issue.fieldName}`, issue.fieldName)
      : translateOr(
          t,
          `doctype.${issue.documentType}`,
          issue.documentType ?? '',
        ),
    where: within || seat || t('detail.f.low_sub'),
    anchor,
    docId: document?.id ?? null,
  };
}

/** One line of the worklist. A finding with somewhere to go is a link into the
 *  register; one without reads the same and simply doesn't move. */
function FindingRow({
  finding,
  confidence,
  onJump,
}: {
  finding: Finding;
  confidence: number | null;
  onJump: Jump;
}) {
  const { t } = useI18n();
  // `shrink` and a wrapping row, not `shrink-0`: at tablet width the old fixed
  // meta column was pushed past the card's clipped edge, taking every finding's
  // confidence figure off the screen with it.
  const body = (
    <>
      <span className='min-w-0 text-[0.8125rem] leading-snug text-foreground'>
        {finding.subject}
      </span>
      <span className='flex min-w-0 shrink items-baseline gap-3'>
        <span className='min-w-0 text-[0.75rem] leading-snug text-muted-foreground'>
          {finding.where}
        </span>
        {confidence !== null && <Confidence value={confidence} bare />}
      </span>
    </>
  );

  const shape =
    'flex flex-wrap items-baseline justify-between gap-x-4 gap-y-0.5 border-b border-rule py-2';

  return (
    <li>
      {finding.anchor ? (
        <a
          href={finding.anchor}
          onClick={onJump(finding.docId, finding.anchor)}
          title={t('detail.attention_go')}
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

function Worklist({
  report,
  pkg,
  onJump,
}: {
  report: ReportDto;
  pkg: PackageDetailDto;
  onJump: Jump;
}) {
  const { t } = useI18n();
  // Findings are counted; observations are mentioned. Counting them together
  // would tell the inspector a package with one missing receipt and four of the
  // registry's own service sheets in it has five problems.
  const archiveFindings = report.issues.filter(issue =>
    isArchiveFinding(issue.kind),
  );
  const findings = report.issues.filter(
    issue => countsAgainstPackage(issue.kind) && !isArchiveFinding(issue.kind),
  );
  const notes = report.issues.filter(
    issue => isObservation(issue.kind) && !isArchiveFinding(issue.kind),
  );
  const named = pkg.files.length > 1;
  // Which of the three the conclusion line is allowed to state. Read off the
  // entity so the panel below and this sentence cannot come to disagree about
  // whether the run settled the question.
  const reading = readReport(findings.length, supportingSetsOf(report));

  // The report's remaining attention belongs to the archive comparison. A
  // second empty conclusion here would say "no issues" above a disagreement.
  if (findings.length === 0 && notes.length === 0 && archiveFindings.length > 0)
    return null;

  const section = (kind: IssueKind, heading: string) => {
    const found = report.issues.filter(issue => issue.kind === kind);
    if (found.length === 0) return null;
    return (
      <div key={kind}>
        <h3 className='register-label'>
          {t(heading)}
          <span data-mono className='ml-2 tabular-nums opacity-70'>
            {found.length}
          </span>
        </h3>
        <ul className='mt-2 flex flex-col border-t border-rule'>
          {found.map((issue, index) => (
            <FindingRow
              key={`${kind}-${index}`}
              finding={findingOf(t, issue, pkg, named)}
              confidence={issue.confidence}
              onJump={onJump}
            />
          ))}
        </ul>
      </div>
    );
  };

  return (
    <section id='attention' className='mb-9 scroll-mt-16'>
      <div className='flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-1'>
        <h2 className='register-label'>{t('detail.attention')}</h2>
        <span
          data-mono
          className='text-[0.75rem] tabular-nums text-muted-foreground'
        >
          {findings.length === 0
            ? t('findings.none')
            : findings.length === 1
              ? t('findings.issue_one')
              : t('findings.issues', { n: findings.length })}
        </span>
      </div>

      {findings.length === 0 ? (
        <p className='mt-3 max-w-[70ch] text-[0.8125rem] leading-relaxed text-muted-foreground'>
          {t('detail.clean')}
          {/* And the sentence stops short of "so there is nothing left to do"
              when a set could not be placed. "We found nothing against it" and
              "we could not work out which papers it needs" are two answers, and
              a conclusion that gave only the first is how the second gets
              missed by the reader it was written for (ADR-0013). */}
          {reading === 'could_not_place' && (
            <>
              {' '}
              <span className='text-foreground/80'>
                {t('detail.clean_open_set')}
              </span>
            </>
          )}
        </p>
      ) : (
        <div className='mt-4 flex flex-col gap-5'>
          {ISSUE_SECTIONS.filter(([kind]) => !isArchiveFinding(kind)).map(
            ([kind, { heading }]) => section(kind, heading),
          )}
        </div>
      )}

      {/* What the package carries beyond what the profile asks for. It is not a
          shortfall, so it does not sit inside the disposition panel and does
          not open by default — it is available, one line down, for the
          inspector who wants the full inventory. */}
      {notes.length > 0 && (
        <details className='group mt-3'>
          <summary className='flex cursor-pointer list-none select-none items-baseline gap-2 text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50'>
            <ChevronRightIcon className='size-3.5 shrink-0 translate-y-0.5 transition-transform duration-200 group-open:rotate-90' />
            {t('detail.observations')}
            <span
              data-mono
              className='text-[0.6875rem] tabular-nums text-muted-foreground/70'
            >
              {notes.length}
            </span>
          </summary>
          <p className='mt-2 max-w-[70ch] pl-5 text-[0.8125rem] leading-relaxed text-muted-foreground'>
            {t('detail.observations_note')}
          </p>
          <div className='mt-3 flex flex-col gap-5 pl-5'>
            {NOTE_SECTIONS.map(([kind, { heading }]) => section(kind, heading))}
          </div>
        </details>
      )}
    </section>
  );
}

// ─── What the applicant has to bring next ────────────────────────────────────
// The third thing a report says, and the only one that is not about the
// envelope that arrived: for the case this submission turned out to be, these
// papers are wanted, and none of them was ever in the package to be judged.
//
// It has a panel of its own, outside the worklist and outside the folded
// observations, for the reason ADR-0013 gives: it is the only line anybody has
// to act on after the report, and both of the places it could have gone say
// something about it that is not true — the worklist would report it as a fault
// of the submission, and the fold would file it with the stray papers nobody
// needs to read.
//
// Nothing here is tinted. The register keeps amber and red for what is wrong
// with a package, and being asked for a document is not a finding against
// anybody: an applicant who reads a warning colour beside this concludes they
// have made a mistake, and an inspector concludes the package is short of
// something. Neither is what it says.
function SupportingDocuments({
  report,
  pkg,
  onJump,
}: {
  report: ReportDto;
  pkg: PackageDetailDto;
  onJump: Jump;
}) {
  const { t } = useI18n();
  const sets = supportingSetsOf(report);

  if (sets.length === 0) return null;

  return (
    <section id='supporting' className='mb-9 scroll-mt-16'>
      <h2 className='register-label'>{t('detail.sec.supporting')}</h2>
      <p className='mt-3 max-w-[70ch] text-[0.8125rem] leading-relaxed text-muted-foreground'>
        {t('supporting.lead')}
      </p>
      <ul className='mt-4 flex flex-col gap-3'>
        {sets.map((set, index) => (
          <SupportingSetEntry
            key={`${set.placed}-${index}`}
            set={set}
            pkg={pkg}
            onJump={onJump}
          />
        ))}
      </ul>
    </section>
  );
}

/**
 * One set, written as an instruction.
 *
 * Both readings open on the same sentence — what has to be brought — and differ
 * only in what follows it. That order is the point: a message that opened on
 * "the height could not be read" would be a report about our own machinery,
 * and the applicant standing at the counter would still not know what to
 * collect. What we could not work out is context for the instruction, never a
 * substitute for it.
 *
 * The papers themselves are not named. `IssueDto` carries no list of them —
 * they travel only in the English audit line, which is written for the record
 * and not for a reader — so the panel says which profile defines the set rather
 * than inventing names for it. Publishing them is a contract change (ADR-0013,
 * "Consequences"), and it lands in the block below and nowhere else.
 */
function SupportingSetEntry({
  set,
  pkg,
  onJump,
}: {
  set: SupportingSet;
  pkg: PackageDetailDto;
  onJump: Jump;
}) {
  const { t } = useI18n();
  const { issue, placed } = set;

  const document = documentsOf(pkg).find(
    candidate => candidate.id === issue.documentId,
  );
  const file = pkg.files.find(candidate => candidate.id === issue.sourceFileId);
  // Same addressing the worklist uses, so the reading the branch turned on is a
  // jump into the sheet rather than a sentence about it.
  const anchor = document
    ? issue.fieldName
      ? fieldAnchor(document.id, issue.fieldName)
      : `#doc-${document.id}`
    : null;

  const subject = issue.fieldName
    ? translateOr(t, `field.${issue.fieldName}`, issue.fieldName)
    : translateOr(t, `doctype.${issue.documentType}`, issue.documentType ?? '');
  const seat = [
    pkg.files.length > 1 ? file?.originalFilename : undefined,
    issue.pageNumber === null
      ? undefined
      : t('detail.page_single', { n: issue.pageNumber }),
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <li className='rounded-lg border border-rule px-4 py-3.5'>
      <div className='flex items-start gap-2.5'>
        <ClipboardListIcon
          aria-hidden
          className='size-4 shrink-0 translate-y-0.5 text-muted-foreground'
        />
        <div className='min-w-0 flex-1'>
          <p className='text-[0.875rem] font-[550] leading-snug text-foreground'>
            {t('supporting.bring')}
          </p>
          <p className='mt-1.5 max-w-[65ch] text-[0.8125rem] leading-relaxed text-muted-foreground'>
            {placed ? t('supporting.placed') : t('supporting.unplaced')}
          </p>

          {/* Which profile the set is defined by. Said in both readings,
              because it is the only place a reader can go for the papers
              themselves until the contract carries them. */}
          <p className='mt-2 max-w-[65ch] text-[0.8125rem] leading-relaxed text-muted-foreground'>
            {t('supporting.defined_by', {
              profile: profileName(t, pkg.profileKey),
            })}
          </p>

          {placed && (
            <div className='mt-3 border-t border-rule pt-2.5'>
              <h3 className='register-label'>{t('supporting.decided_on')}</h3>
              <div className='mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1'>
                {anchor ? (
                  <a
                    href={anchor}
                    onClick={onJump(document?.id ?? null, anchor)}
                    title={t('detail.attention_go')}
                    className='text-[0.8125rem] leading-snug text-foreground underline decoration-rule-strong underline-offset-3 transition-colors hover:decoration-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
                  >
                    {subject}
                  </a>
                ) : (
                  <span className='text-[0.8125rem] leading-snug text-foreground'>
                    {subject}
                  </span>
                )}
                {seat && (
                  <span className='text-[0.75rem] leading-snug text-muted-foreground'>
                    {seat}
                  </span>
                )}
                {issue.confidence !== null && (
                  <Confidence value={issue.confidence} bare />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function PendingReview({ running }: { running: boolean }) {
  const { t } = useI18n();
  return (
    <section id='attention' className='scroll-mt-16 py-7'>
      <h2 className='text-lg font-[550] tracking-[-0.015em] text-foreground'>
        {t('detail.attention')}
      </h2>
      <p className='mt-2 max-w-[65ch] text-[0.875rem] leading-relaxed text-muted-foreground'>
        {running
          ? t('detail.review_preparing_note')
          : t('detail.review_unavailable')}
      </p>
    </section>
  );
}

// ─── Cross-document checks ───────────────────────────────────────────────────
// The one place on the surface where two documents are read on one line. Every
// other section reports a document; this reports the submission — the name on
// the identity card beside the name the application is made in, the address as
// each paper writes it. It is the check an inspector would otherwise make by
// holding two sheets up against each other, so it is laid out the way they
// would: one row per document, values down one column, the value each row
// contributes readable in full.
//
// A check that agreed is kept and folded rather than dropped: it is what the
// inspector does not have to redo, and a panel showing only the failures would
// leave them wondering which comparisons were made at all.
const VERDICT_TONE: Record<CrossCheckVerdict, Tone> = {
  Match: 'ok',
  Mismatch: 'issues',
  Unclear: 'incomplete',
};

const VERDICT_LABEL: Record<CrossCheckVerdict, string> = {
  Match: 'detail.check_agreed',
  Mismatch: 'detail.check_disagreed',
  Unclear: 'detail.check_unclear',
};

function VerdictMark({ verdict }: { verdict: CrossCheckVerdict }) {
  const { t } = useI18n();

  return (
    <OutcomeMark
      tone={VERDICT_TONE[verdict]}
      label={t(VERDICT_LABEL[verdict])}
    />
  );
}

/** One value a check weighed. It is a jump into the register, because the way
 *  to settle a disagreement is to look at the sheet the value was read off. */
function CheckedValueRow({
  value,
  onJump,
}: {
  value: CheckedValueDto;
  onJump: Jump;
}) {
  const { t } = useI18n();
  const anchor = value.documentId
    ? fieldAnchor(value.documentId, value.fieldName)
    : null;

  const body = (
    <>
      <span className='min-w-0 text-[0.8125rem] leading-snug text-muted-foreground'>
        {translateOr(t, `doctype.${value.documentType}`, value.documentType)}
        <span className='text-muted-foreground/60'>
          {' · '}
          {translateOr(t, `field.${value.fieldName}`, value.fieldName)}
        </span>
      </span>
      <span className='flex min-w-0 items-baseline gap-3'>
        <span
          data-mono
          className='min-w-0 break-words text-[0.875rem] leading-snug text-foreground'
        >
          {value.value}
        </span>
        <Confidence value={value.confidence} bare />
      </span>
    </>
  );

  const shape =
    'grid gap-x-6 gap-y-0.5 border-b border-rule py-2 sm:grid-cols-[minmax(10rem,18rem)_minmax(0,1fr)]';

  return (
    <li>
      {anchor ? (
        <a
          href={anchor}
          onClick={onJump(value.documentId, anchor)}
          title={t('detail.checks_go')}
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

function CrossCheckEntry({
  check,
  onJump,
}: {
  check: CrossCheckDto;
  onJump: Jump;
}) {
  const { t } = useI18n();

  return (
    // Open where there is something to settle, folded where there is not: a
    // panel of five agreements spelled out would push the one disagreement off
    // the screen it is on.
    <details
      id={`check-${check.key}`}
      className='group scroll-mt-16'
      open={check.verdict !== 'Match'}
    >
      <summary className='-mx-2 flex cursor-pointer list-none select-none flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md px-2 py-2 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50'>
        <ChevronRightIcon className='size-3.5 shrink-0 translate-y-0.5 text-muted-foreground transition-transform duration-200 group-open:rotate-90' />
        <span className='min-w-0 text-[0.8125rem] leading-snug text-foreground'>
          {translateOr(t, `check.${check.key}`, check.key)}
        </span>
        <span className='ml-auto flex shrink-0 items-baseline gap-2'>
          <VerdictMark verdict={check.verdict} />
          <Confidence value={check.confidence} bare />
        </span>
      </summary>
      <ul className='mt-1 flex flex-col border-t border-rule pl-5'>
        {check.values.map((value, index) => (
          <CheckedValueRow
            key={`${value.documentId ?? 'gone'}-${value.fieldName}-${index}`}
            value={value}
            onJump={onJump}
          />
        ))}
      </ul>
    </details>
  );
}

function DocumentComparisons({
  checks,
  running,
  onJump,
}: {
  checks: readonly CrossCheckDto[];
  running: boolean;
  onJump: Jump;
}) {
  const { t } = useI18n();
  const agreed = checks.filter(check => check.verdict === 'Match').length;

  return (
    <section id='document-comparison' className='mb-9 scroll-mt-16'>
      <div className='flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-1'>
        <h2 className='register-label'>{t('detail.checks_result')}</h2>
        {checks.length > 0 && (
          <span
            data-mono
            className={cn(
              'text-[0.75rem] tabular-nums',
              agreed === checks.length
                ? 'text-muted-foreground'
                : 'text-issues-ink',
            )}
          >
            {t('detail.checks_agreed', { n: agreed, total: checks.length })}
          </span>
        )}
      </div>
      <p className='mt-2 max-w-[70ch] text-[0.8125rem] leading-relaxed text-muted-foreground'>
        {t('detail.checks_result_note')}
      </p>
      {checks.length > 0 ? (
        <div className='mt-3 flex flex-col divide-y divide-rule border-t border-rule'>
          {checks.map(check => (
            <CrossCheckEntry key={check.key} check={check} onJump={onJump} />
          ))}
        </div>
      ) : (
        <p className='mt-3 border-t border-rule py-3 text-[0.8125rem] leading-relaxed text-muted-foreground'>
          {running ? t('detail.checks_pending') : t('detail.checks_none')}
        </p>
      )}
    </section>
  );
}

// ─── The archive register ────────────────────────────────────────────────────
// The sixth stage, and the only one on this page that reports something from
// outside the envelope: the property as the papers address it, against the
// record of what was registered (ADR-0009).
//
// It is rendered whether or not it found anything, and whether or not it agreed
// — including when it never answered. A stage that reported only its
// disagreements would be a stage an inspector could not tell had run, and "the
// register was asked and confirmed it" is exactly the lookup they would
// otherwise make by hand.
// The tones, the words and the sentences are the entity's: five verdicts, five
// tones, and the difference between "the record says otherwise" and "the
// register has nothing" carried by the colour as well as by the word.
/** One value held against the record: what the package states above what the
 *  register has, so the two are read down one column rather than across. */
function RegistryAttributeRow({
  attribute,
  onJump,
}: {
  attribute: RegistryAttributeDto;
  onJump: Jump;
}) {
  const { t } = useI18n();
  const submitted = attribute.submitted;
  const anchor = submitted.documentId
    ? fieldAnchor(submitted.documentId, submitted.fieldName)
    : null;

  const body = (
    <>
      <span className='flex min-w-0 items-baseline gap-1.5 text-[0.8125rem] leading-snug text-muted-foreground'>
        {attribute.recorded === null ? (
          <span aria-hidden className='w-3 shrink-0' />
        ) : attribute.agrees ? (
          <CheckIcon className='size-3 shrink-0 translate-y-0.5 text-ok-ink' />
        ) : (
          <TriangleAlertIcon className='size-3 shrink-0 translate-y-0.5 text-issues-ink' />
        )}
        <span className='min-w-0'>
          {translateOr(t, `regattr.${attribute.name}`, attribute.name)}
          <span className='text-muted-foreground/60'>
            {' · '}
            {translateOr(
              t,
              `doctype.${submitted.documentType}`,
              submitted.documentType,
            )}
          </span>
        </span>
      </span>
      <span className='flex min-w-0 flex-col gap-0.5'>
        <span className='flex min-w-0 items-baseline gap-2'>
          <span className='w-[6.5rem] shrink-0 text-[0.6875rem] leading-snug text-muted-foreground/70'>
            {t('detail.reg.submitted')}
          </span>
          <span
            data-mono
            className='min-w-0 break-words text-[0.875rem] leading-snug text-foreground'
          >
            {submitted.value}
          </span>
          <Confidence value={submitted.confidence} bare />
        </span>
        <span className='flex min-w-0 items-baseline gap-2'>
          <span className='w-[6.5rem] shrink-0 text-[0.6875rem] leading-snug text-muted-foreground/70'>
            {t('detail.reg.recorded')}
          </span>
          {attribute.recorded === null ? (
            <span className='min-w-0 text-[0.8125rem] italic leading-snug text-muted-foreground'>
              {t('detail.reg.silent')}
            </span>
          ) : (
            <span
              data-mono
              className={cn(
                'min-w-0 break-words text-[0.875rem] leading-snug',
                attribute.agrees ? 'text-muted-foreground' : 'text-issues-ink',
              )}
            >
              {attribute.recorded}
            </span>
          )}
        </span>
      </span>
    </>
  );

  const shape =
    'grid gap-x-6 gap-y-1 border-b border-rule py-2 sm:grid-cols-[minmax(10rem,18rem)_minmax(0,1fr)]';

  return (
    <li>
      {anchor ? (
        <a
          href={anchor}
          onClick={onJump(submitted.documentId, anchor)}
          title={t('detail.checks_go')}
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

/**
 * One paper the submission rests on, and what the archive has of it.
 *
 * The register's own word for the kind of paper is not shown: it is
 * Azerbaijani, it is the archive's filing vocabulary rather than anybody's
 * reading vocabulary, and the reader is looking at their own document. What is
 * shown is the document type they know it by, the standing, and — when the
 * archive has it — where the original is, which is the whole point of asking.
 */
function RegistryDocumentRow({
  document,
  onJump,
}: {
  document: RegistryDocumentDto;
  onJump: Jump;
}) {
  const { t } = useI18n();
  const holding = HOLDING_TONE[document.holding];

  const body = (
    <>
      <span className='flex min-w-0 items-baseline gap-1.5 text-[0.8125rem] leading-snug text-muted-foreground'>
        {/* Three states, three marks. `Unknown` used to be drawn as blank
            space, which left it reading as a row that had not loaded — it is a
            state the archive is in, so it is stated: a dash, because a column
            an area's presence register never kept is silence and not a gap in
            the submission (ADR-0010). */}
        {holding === 'ok' ? (
          <CheckIcon className='size-3 shrink-0 translate-y-0.5 text-ok-ink' />
        ) : holding === 'issues' ? (
          <TriangleAlertIcon className='size-3 shrink-0 translate-y-0.5 text-issues-ink' />
        ) : (
          <MinusIcon className='size-3 shrink-0 translate-y-0.5 text-muted-foreground/50' />
        )}
        <span className='min-w-0'>
          {translateOr(t, `doctype.${document.type}`, document.type)}
        </span>
      </span>
      <span className='flex min-w-0 flex-col gap-0.5'>
        <span
          className={cn(
            'text-[0.8125rem] leading-snug',
            holding === 'issues'
              ? 'text-issues-ink'
              : holding === 'silent'
                ? 'italic text-muted-foreground'
                : 'text-muted-foreground',
          )}
        >
          {t(HOLDING_KEY[document.holding])}
        </span>
        {(document.number ?? document.reference) && (
          <span className='flex min-w-0 flex-wrap items-baseline gap-x-2'>
            {document.number && (
              <span
                data-mono
                className='min-w-0 break-words text-[0.8125rem] leading-snug text-foreground'
              >
                {document.number}
                {document.issuedOn ? ` · ${document.issuedOn}` : ''}
              </span>
            )}
            {document.reference && (
              <span
                data-mono
                className='min-w-0 break-words text-[0.75rem] leading-snug text-muted-foreground/70'
              >
                {document.reference}
              </span>
            )}
          </span>
        )}
      </span>
    </>
  );

  const shape =
    'grid gap-x-6 gap-y-1 border-b border-rule py-2 sm:grid-cols-[minmax(10rem,18rem)_minmax(0,1fr)]';
  const anchor = document.documentId ? `#doc-${document.documentId}` : null;

  return (
    <li>
      {anchor && document.documentId ? (
        <a
          href={anchor}
          onClick={onJump(document.documentId, anchor)}
          title={t('detail.checks_go')}
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

function RegistryCheckEntry({
  check,
  onJump,
}: {
  check: RegistryCheckDto;
  onJump: Jump;
}) {
  const { t } = useI18n();
  const differences = check.attributes.filter(attribute => !attribute.agrees);

  return (
    // Open unless the record confirmed it, on the same rule as a cross-check:
    // an agreement is stated and folded, anything else is where the work is.
    <details
      id={`registry-${check.key}`}
      className='group scroll-mt-16'
      open={check.outcome !== 'Confirmed'}
    >
      <summary className='-mx-2 flex cursor-pointer list-none select-none flex-wrap items-baseline gap-x-3 gap-y-1 rounded-md px-2 py-2 transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50'>
        <ChevronRightIcon className='size-3.5 shrink-0 translate-y-0.5 text-muted-foreground transition-transform duration-200 group-open:rotate-90' />
        <span className='min-w-0 text-[0.8125rem] leading-snug text-foreground'>
          {translateOr(t, `check.${check.key}`, check.key)}
        </span>
        <span className='ml-auto flex shrink-0 items-baseline gap-2'>
          <RegistryOutcomeMark outcome={check.outcome} />
          <Confidence value={check.confidence} bare />
        </span>
      </summary>
      <div className='mt-1 border-t border-rule pl-5'>
        <p className='max-w-[70ch] py-2 text-[0.8125rem] leading-relaxed text-muted-foreground'>
          {t(OUTCOME_NOTE[check.outcome])}
        </p>
        {/* The address the register was given, as a jump into the sheet it was
            read off: a lookup that found nothing is answered by checking what
            was asked before it is answered by anything else. */}
        <ul className='flex flex-col'>
          <CheckedValueRow value={check.asked} onJump={onJump} />
          {differences.map((attribute, index) => (
            <RegistryAttributeRow
              key={`${attribute.name}-${index}`}
              attribute={attribute}
              onJump={onJump}
            />
          ))}
        </ul>
        {/* Every paper asked about, held or not: the ones the archive has are
            what the inspector does not have to go and look for, and a list that
            showed only the gaps would be a list they could not trust. */}
        {check.documents.length > 0 && (
          <>
            <p className='pt-3 text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground/70'>
              {t('detail.reg.papers')}
            </p>
            <ul className='flex flex-col'>
              {check.documents.map((document, index) => (
                <RegistryDocumentRow
                  key={`${document.name}-${index}`}
                  document={document}
                  onJump={onJump}
                />
              ))}
            </ul>
          </>
        )}
        {check.reference && (
          <p className='flex flex-wrap items-baseline gap-2 py-2 text-[0.8125rem] text-muted-foreground'>
            {t('detail.registry_where')}
            <span data-mono className='text-foreground/80'>
              {check.reference}
            </span>
          </p>
        )}
      </div>
    </details>
  );
}

function RegistryChecks({
  checks,
  running,
  onJump,
}: {
  checks: readonly RegistryCheckDto[];
  // A run still under way has not reached the register yet; one that finished
  // and carries no answer was either unable to ask or unable to reach it.
  running: boolean;
  onJump: Jump;
}) {
  const { t } = useI18n();
  const confirmed = checks.filter(
    check => check.outcome === 'Confirmed',
  ).length;
  // Reddened by what is actually held against the package, never by everything
  // short of `Confirmed`: an address the register has never heard of leaves the
  // submission with nothing against it, and a tally that coloured for it would
  // tell the reader the register found fault where it found nothing (ADR-0009).
  const against = checks.some(check => speaksAgainst(check.outcome));

  return (
    <section id='archive-comparison' className='mb-9 scroll-mt-16'>
      <div className='flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 pb-1'>
        <h2 className='register-label'>{t('detail.archive_comparison')}</h2>
        {checks.length > 0 && (
          <span
            data-mono
            className={cn(
              'text-[0.75rem] tabular-nums',
              against ? 'text-issues-ink' : 'text-muted-foreground',
            )}
          >
            {t('detail.checks_agreed', {
              n: confirmed,
              total: checks.length,
            })}
          </span>
        )}
      </div>
      {checks.length > 0 ? (
        <div className='mt-3 flex flex-col divide-y divide-rule border-t border-rule'>
          {checks.map(check => (
            <RegistryCheckEntry key={check.key} check={check} onJump={onJump} />
          ))}
        </div>
      ) : (
        <p className='mt-3 max-w-[70ch] border-t border-rule py-3 text-[0.8125rem] leading-relaxed text-muted-foreground/80'>
          {running ? t('detail.registry_pending') : t('detail.registry_none')}
        </p>
      )}
    </section>
  );
}

// ─── The case sheet ───────────────────────────────────────────────────────────
// The package as a sheet of paper: the office's letterhead, the case number and
// the date it was taken in, what the papers say about the property, and the two
// numbered sections an inspector reads down — how far the run got, and what the
// profile asks for against what arrived.
//
// It is a sheet and not a dashboard because that is what it is for. An
// inspector works this case at a desk, prints it, and puts it in a file; the
// evidence behind every line of it is in the panels below, and this is the page
// that gets signed. Everything on it is read off the contract — nothing here is
// worked out on the screen.
//
// **It states and never decides.** There is no verdict on this sheet and no
// place to record one: the inspector decides, outside this system, and a sheet
// that offered Approve / Refuse would be this product claiming a judgement it
// has never made.

/** One line of the requisites table: what the papers were read to say. */
function Requisite({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <tr className='border-b border-rule last:border-0'>
      <th
        scope='row'
        className='register-label w-[13rem] py-2.5 pr-4 text-left align-top font-normal'
      >
        {label}
      </th>
      <td className='py-2.5 align-top text-[0.875rem] text-foreground'>
        {children}
      </td>
    </tr>
  );
}

/**
 * A value the engine read off the papers, as the sheet says it: the reading,
 * and — only where the engine was unsure — the figure it was read with.
 *
 * The same rule the register's rows are drawn by. A sure confidence is a number
 * nobody reads; an unsure one is the whole reason a reading is shown on a sheet
 * somebody might cite from.
 */
function SheetValue({ value }: { value: StatedValueDto | null }) {
  const { t } = useI18n();
  if (value === null) {
    return <span className='text-muted-foreground/60'>—</span>;
  }
  const percent = Math.round(value.confidence * 100);
  return (
    <span className='flex min-w-0 flex-wrap items-baseline gap-x-2'>
      <span>{value.value}</span>
      {!readWellEnough(value.confidence) && (
        <span
          data-mono
          title={t('intake.read.glance', { p: percent })}
          className='shrink-0 text-[0.6875rem] text-incomplete-ink'
        >
          {percent}%
        </span>
      )}
    </span>
  );
}

/**
 * A value somebody typed at the counter. Never drawn with a confidence — a
 * declaration carries none, and the moment it is shown among readings a figure
 * nobody checked reads as one the engine found (ADR-0021).
 *
 * "Not declared" is drawn rather than left blank. A report that is silent about
 * a disagreement reads differently depending on whether the office declared
 * anything at all, and every package taken in before intake asked says this.
 */
function DeclaredValue({
  value,
  // A figure is set in the register's mono face like every other figure on this
  // page; the name of a paper is a name and reads as prose.
  figure = false,
}: {
  value: string | null;
  figure?: boolean;
}) {
  const { t } = useI18n();
  if (value === null) {
    return (
      <span className='text-muted-foreground/70'>
        {t('declared.not_declared')}
      </span>
    );
  }
  return <span data-mono={figure ? '' : undefined}>{value}</span>;
}

function CaseSheet({
  pkg,
  view,
  profile,
  stages,
  running,
  failed,
  stageRunning,
  missing,
  required,
  settled,
  onAddFiles,
  onApprove,
  onJump,
}: {
  pkg: PackageDetailDto;
  view: VerificationPackage;
  /** Null while the profiles are still loading, and null is what the sheet
   *  wants: it lists no required documents rather than listing the wrong ones. */
  profile: ProfileDto | null;
  stages: StageStatus[];
  running: boolean;
  failed: boolean;
  stageRunning: boolean;
  missing: readonly string[];
  required: readonly string[];
  settled: boolean;
  onAddFiles: (() => void) | null;
  onApprove: (() => void) | null;
  onJump: Jump;
}) {
  const { t, locale } = useI18n();
  const shortfall = new Set(missing);

  return (
    <article className='overflow-hidden rounded-xl border border-rule bg-card shadow-[var(--shadow-sm)] print:border-0 print:shadow-none'>
      <div className='px-5 py-6 md:px-9 md:py-8'>
        {/* ── Letterhead ──
            The office the sheet comes from, before the case it is about. Three
            lines and not one: the service, the legal entity that keeps the
            register, and the territorial department that took this package in. */}
        <header>
          <p className='flex flex-col gap-0.5 text-[0.6875rem] leading-snug tracking-[0.06em] text-muted-foreground uppercase'>
            <strong className='font-semibold text-foreground/80'>
              {t('sheet.institution')}
            </strong>
            <span>{t('sheet.entity')}</span>
            <span>{t('sheet.unit')}</span>
          </p>

          {/* The ruled band that separates the letterhead from the case — the
              mockup's двойная линейка, drawn from the rule tokens so it holds
              in both themes. */}
          <div aria-hidden className='mt-4 flex flex-col gap-[2px]'>
            <span className='block h-px bg-rule-strong' />
            <span className='block h-px bg-rule' />
          </div>

          <div className='mt-4 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1'>
            <p className='text-[0.8125rem] text-muted-foreground'>
              {t('sheet.case_no')}{' '}
              <span data-mono className='text-foreground'>
                {pkg.id}
              </span>
            </p>
            <p className='text-[0.8125rem] text-muted-foreground'>
              {t('sheet.taken_in', { d: formatDate(pkg.createdAt, locale) })}
            </p>
          </div>

          <h1 className='mt-2.5 text-balance text-[1.375rem] font-semibold leading-tight tracking-[-0.02em] text-foreground'>
            {profileName(t, view.profile)}
          </h1>
          <p className='mt-1 text-[0.875rem] italic text-muted-foreground'>
            {t('sheet.subject')}
          </p>
        </header>

        {/* ── Where it stands ──
            The one line on this sheet written for a person, read off the
            contract and never derived here (ADR-0014). The move it names is
            offered beside it, because a standing that says what has to happen
            and makes the reader go and find it is half a sentence. */}
        <section className='mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-rule bg-secondary/60 px-4 py-3'>
          <span className='register-label shrink-0'>
            {t('sheet.situation')}
          </span>
          <StandingMark standing={pkg.standing} />
          <span className='ml-auto shrink-0 text-[0.75rem] text-muted-foreground'>
            {t('updated.ago', {
              t: relativeShort(pkg.updatedAt, Date.now()),
            })}
          </span>
        </section>
        <p className='mt-2 max-w-[70ch] text-[0.8125rem] leading-snug text-muted-foreground'>
          {t(STANDING_NOTE[pkg.standing])}
        </p>

        {/* ── Requisites ──
            What the papers were read to say, over what the counter typed. The
            two are kept apart and labelled apart: a reading can be read badly
            and carries the figure it was read with, and a declaration cannot
            and does not (ADR-0021). */}
        <p className='mt-6 register-label'>{t('sheet.read_off')}</p>
        <table className='mt-1 w-full border-collapse'>
          <tbody>
            <Requisite label={t('sheet.applicant')}>
              <SheetValue value={view.applicant} />
            </Requisite>
            <Requisite label={t('sheet.address')}>
              <SheetValue value={view.address} />
            </Requisite>
            <Requisite label={t('sheet.cadastral')}>
              <SheetValue value={pkg.cadastralNumber} />
            </Requisite>
          </tbody>
        </table>

        <p className='mt-5 register-label'>{t('declared.title')}</p>
        <p className='mt-1 max-w-[70ch] text-[0.75rem] leading-snug text-muted-foreground'>
          {t('detail.declared_note')}
        </p>
        <table className='mt-1.5 w-full border-collapse'>
          <tbody>
            <Requisite label={t('declared.basis')}>
              <DeclaredValue
                value={
                  pkg.declared.legalBasis === null
                    ? null
                    : groundName(t, pkg.declared.legalBasis)
                }
              />
            </Requisite>
            <Requisite label={t('declared.year')}>
              <DeclaredValue
                figure
                value={
                  pkg.declared.builtYear === null
                    ? null
                    : String(pkg.declared.builtYear)
                }
              />
            </Requisite>
          </tbody>
        </table>

        {/* ── I. Processing stages ── */}
        <section className='mt-7'>
          <h2 className='flex items-baseline gap-3 border-b border-rule-strong pb-1.5 text-[0.8125rem] font-semibold tracking-[0.04em] text-foreground uppercase'>
            <span>{t('sheet.section.stages')}</span>
          </h2>
          <div className='mt-4'>
            <RunProgress
              stages={stages}
              running={running}
              failed={failed}
              stageRunning={stageRunning}
            />
          </div>
        </section>

        {/* ── II. Documents ──
            Every paper the profile insists on, in the profile's own order, each
            said to be in the package or not — the mockup's numbered list. It
            reports a shortfall and never refuses the package: a document the
            classifier could not place may still be the missing one, and the
            inspector decides. */}
        <section className='mt-7'>
          <h2 className='flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-rule-strong pb-1.5 text-[0.8125rem] font-semibold tracking-[0.04em] text-foreground uppercase'>
            <span>{t('sheet.section.documents')}</span>
            {settled && required.length > 0 && (
              <span
                data-mono
                className={cn(
                  'text-[0.6875rem] font-normal tracking-normal normal-case tabular-nums',
                  missing.length > 0
                    ? 'text-incomplete-ink'
                    : 'text-muted-foreground',
                )}
              >
                {t('detail.required_found', {
                  n: required.length - missing.length,
                  total: required.length,
                })}
              </span>
            )}
          </h2>

          {profile === null || required.length === 0 ? (
            <p className='mt-4 text-[0.8125rem] leading-snug text-muted-foreground'>
              {t('sheet.documents.unknown')}
            </p>
          ) : !settled ? (
            <p className='mt-4 text-[0.8125rem] leading-snug text-muted-foreground'>
              {t('detail.required_pending')}
            </p>
          ) : (
            <ol className='mt-2'>
              {required.map(type => {
                const short = shortfall.has(type);
                return (
                  <li
                    key={type}
                    className='flex flex-wrap items-baseline gap-x-4 gap-y-0.5 border-b border-rule py-2.5 last:border-0'
                  >
                    {/* The word and not the colour carries it — the rule every
                        disposition on this surface is drawn by. */}
                    <span
                      className={cn(
                        'w-[6.5rem] shrink-0 text-[0.6875rem] font-semibold tracking-[0.08em] uppercase',
                        short ? 'text-incomplete-ink' : 'text-ok-ink',
                      )}
                    >
                      {t(short ? 'sheet.doc.missing' : 'sheet.doc.present')}
                    </span>
                    <span className='min-w-0 flex-1 text-[0.875rem] text-foreground'>
                      {translateOr(t, `doctype.${type}`, type)}
                    </span>
                  </li>
                );
              })}
            </ol>
          )}

          {/* What the applicant still has to bring, where the profile branches
              — stated on the sheet because it outlives the review. */}
          {pkg.report && (
            <SupportingDocuments
              report={pkg.report}
              pkg={pkg}
              onJump={onJump}
            />
          )}
        </section>

        {/* ── What can be done about it ──
            The moves this system actually offers, and no others. There is no
            Approve and no Refuse: the decision is the inspector's and is taken
            off this screen. */}
        <div className='mt-7 flex flex-wrap gap-2 print:hidden'>
          {onApprove && (
            <Button onClick={onApprove}>
              <StampIcon /> {t('approve.action')}
            </Button>
          )}
          {onAddFiles && (
            <Button variant='outline' onClick={onAddFiles}>
              <PlusIcon /> {t('add.action')}
            </Button>
          )}
          <Button variant='outline' onClick={() => window.print()}>
            <PrinterIcon /> {t('sheet.print')}
          </Button>
        </div>
      </div>

      <footer className='flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-rule bg-secondary/40 px-5 py-3 text-[0.75rem] text-muted-foreground md:px-9'>
        <span>{t('sheet.foot')}</span>
        <span data-mono>{t('sheet.foot_mark')}</span>
      </footer>
    </article>
  );
}

// ─── One folded stage ─────────────────────────────────────────────────────────
// The evidence behind the sheet, in the order the run produced it, each behind
// a fold that says what is inside before it is opened. A summary line on the
// fold is what makes the stack readable shut: an inspector who only wants to
// know how the archive answered should not have to open the archive to find out.
function StagePanel({
  id,
  title,
  summary,
  open,
  onOpenChange,
  children,
}: {
  id: string;
  title: string;
  /** What the panel says while it is closed. */
  summary?: ReactNode;
  open: boolean;
  /** The reader folding it by hand. Kept above this component so a jump can
   *  open a fold the reader is not looking at without it being shut again by
   *  the next render the poll causes. */
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className='group scroll-mt-16 overflow-hidden rounded-xl border border-rule bg-card shadow-[var(--shadow-xs)] print:hidden'
    >
      <h2>
        <button
          type='button'
          aria-expanded={open}
          aria-controls={`${id}-body`}
          onClick={() => onOpenChange(!open)}
          className='flex w-full cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3.5 text-left transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:px-6'
        >
          <ChevronRightIcon
            aria-hidden
            className={cn(
              'size-3.5 shrink-0 text-muted-foreground transition-transform duration-200',
              open && 'rotate-90',
            )}
          />
          <span className='text-[0.9375rem] font-semibold tracking-[-0.01em] text-foreground'>
            {title}
          </span>
          {summary !== undefined && (
            <span className='ml-auto shrink-0 text-[0.8125rem] font-normal text-muted-foreground'>
              {summary}
            </span>
          )}
        </button>
      </h2>
      {/* A button and a region rather than `<details>`. React does not
          reconcile `open` on a `<details>` after it has mounted, so a fold this
          page opens for an arriving link — or for a finding pointing into it —
          stayed shut while the state beside it said otherwise. A disclosure
          built out of `aria-expanded` and a region is controlled all the way
          down, and says the same thing to a screen reader. */}
      {open && (
        <div
          id={`${id}-body`}
          className='border-t border-rule px-5 py-6 md:px-6'
        >
          {children}
        </div>
      )}
    </section>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export function VerificationDetails() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { id } = useParams();

  // Poll while the pipeline is still working; stop once it settles. The toggle
  // is adjusted during render (no effect) from the data we just received.
  const [polling, setPolling] = useState(true);
  // Null until the inspector picks one, so the default can follow what the run
  // actually found rather than being frozen at first render — the package is
  // still being verified while this page is open.
  const [pickedSegment, setPickedSegment] = useState<DocSegment | null>(null);
  // Which folds have been opened or shut against their default — see
  // `PanelOverrides`.
  const [panels, setPanels] = useState<PanelOverrides>({});
  const foldPanel = useCallback(
    (panel: PanelId, open: boolean) =>
      setPanels(current => ({ ...current, [panel]: open })),
    [],
  );
  const revealPanel = useCallback(
    (panel: PanelId) => foldPanel(panel, true),
    [foldPanel],
  );
  const {
    data: pkg,
    isLoading,
    isError,
  } = useGetPackageQuery(id ?? skipToken, {
    pollingInterval: polling ? 1500 : 0,
    skipPollingIfUnfocused: true,
  });
  // The profile says which documents the package must carry; the register never
  // keeps a copy of that policy (ADR-0002).
  const { data: profiles } = useGetProfilesQuery();
  const shouldPoll = pkg?.status === 'Pending' || pkg?.status === 'Processing';
  if (shouldPoll !== polling) setPolling(shouldPoll);

  // A link from outside — a bookmark, a message, the browser's own history —
  // arrives with a fragment and no click to open the fold it points into, and
  // would otherwise land on a shut panel. Waits for the package, because until
  // it has arrived the panels are not in the document to be opened.
  const arrived = pkg !== undefined;
  useEffect(() => {
    if (!arrived) return;
    const { hash } = window.location;
    if (hash === '') return;
    revealPanel(panelForHash(hash));
    // The fold has to be laid out open before the browser can find what it
    // points at, and opening it is a state change — so the scroll waits for the
    // render that change causes rather than for the current one.
    requestAnimationFrame(() => {
      document.getElementById(hash.slice(1))?.scrollIntoView();
    });
  }, [arrived, revealPanel]);

  if (isLoading) {
    return (
      <SurfacePage>
        <SurfaceBody>
          <div
            aria-busy='true'
            aria-live='polite'
            className='mx-auto flex w-full max-w-[64rem] flex-col gap-4 px-4 py-6 md:px-8 md:py-8'
          >
            {/* The shape of what is coming: the sheet, then the folds under it.
                A skeleton laid out differently from what replaces it is a page
                that jumps the moment the answer lands. */}
            <Skeleton className='h-[28rem] w-full rounded-xl' />
            <Skeleton className='h-12 w-full rounded-xl' />
            <Skeleton className='h-12 w-full rounded-xl' />
            <Skeleton className='h-12 w-full rounded-xl' />
          </div>
        </SurfaceBody>
      </SurfacePage>
    );
  }

  if (isError || !pkg) {
    return (
      <SurfacePage>
        <SurfaceBody>
          <div className='mx-auto flex w-full max-w-[64rem] flex-col items-start gap-4 px-4 py-10 md:px-8'>
            <h1 className='text-[1.375rem] font-semibold leading-tight tracking-[-0.02em] text-foreground'>
              {t('detail.notfound.title')}
            </h1>
            <p className='max-w-[60ch] text-[0.875rem] leading-relaxed text-muted-foreground'>
              {t('detail.notfound.body')}
            </p>
            <Button variant='outline' onClick={() => navigate(paths.cases)}>
              <ArrowLeftIcon /> {t('detail.back')}
            </Button>
          </div>
        </SurfaceBody>
      </SurfacePage>
    );
  }

  const view = toViewPackage(pkg);
  const stages = stageStatuses(pkg, view.disposition);
  const stageRunning = stages.some(s => s === 'current');
  const documents = documentsOf(pkg);
  const failed = view.disposition === 'failed';
  const running = !pkg.report && !failed;
  // Only once classification has been through every document is a type's
  // absence a finding rather than a stage that has not run yet.
  const classified = stages[2] === 'done' || stages[2] === 'error';
  // Null while the profiles are still loading, and null is what the sheet
  // wants: it lists no required documents rather than listing the wrong ones.
  const profile =
    profiles?.find(candidate => candidate.key === view.profile) ?? null;
  // Every paper the profile insists on, in the profile's own order. The sheet
  // names each one and says whether it arrived, so it needs the list itself and
  // not just the count — the profile is the only thing that holds that order.
  const required = profile ? requiredTypes(profile) : [];
  // Which of them the package is short of is the **server's** answer and never
  // one worked out here: the same list the «Загрузить» buttons are drawn from,
  // so the sheet and the gaps panel can never disagree about what is missing
  // (COMM-80). It is also the only correct one now that a scan can be replaced
  // — a spent scan keeps its type, so a package whose replacement failed to
  // classify would read as complete if this were derived from the documents.
  const missing = missingTypes(pkg.gaps);

  const counts = {
    review: documents.filter(d => needsReview(d)).length,
    all: documents.length,
    other: documents.filter(isAside).length,
  };
  const reviewCount = pkg.report
    ? pkg.report.issues.filter(
        issue =>
          countsAgainstPackage(issue.kind) && !isArchiveFinding(issue.kind),
      ).length
    : counts.review;
  const unmatchedChecks = pkg.crossChecks.filter(
    check => check.verdict !== 'Match',
  ).length;
  const unconfirmedRegistry = pkg.registryChecks.filter(
    check => check.outcome !== 'Confirmed',
  ).length;
  // Open on the work when there is work: a package this size is mostly settled,
  // and the segment that shows only what wants a second look is the one the
  // inspector would pick anyway. With nothing flagged there is nothing to
  // filter to, so the register opens whole.
  const segment = pickedSegment ?? (counts.review > 0 ? 'review' : 'all');

  // Whether another file can be put in this package at all — the contract's own
  // answer, not a list of states kept here. While a run is under way the answer
  // is no, and the rail offers nothing rather than an action that would be
  // refused.
  const accepting = takesFiles(pkg.status);

  // The sheet's shortcut into the panel that takes files. The fold has to be
  // open before the fragment is applied, or the jump lands in content that is
  // not laid out yet — the same order the finding jumps below take.
  //
  // It lands on the gaps where the package publishes any, because that is where
  // the move is: a row naming the paper, with the button that answers it. Only a
  // package the server will take nothing targeted for drops to the batch panel.
  const goToAddFiles = () => {
    const anchor = pkg.gaps.length > 0 ? '#document-gaps' : '#add-files';
    revealPanel(PANEL.documents);
    requestAnimationFrame(() => {
      window.location.hash = anchor;
    });
  };

  // Offered only while a signature is what the submission is actually waiting
  // on — the standing is what says so, and it is the contract's answer rather
  // than one worked out here (ADR-0014).
  const goToApproval =
    pkg.standing === 'AwaitingArchiveApproval'
      ? () => {
          revealPanel(PANEL.archive);
          requestAnimationFrame(() => {
            window.location.hash = '#archive-approval';
          });
        }
      : null;

  // A finding always takes the inspector to its evidence, even when the
  // evidence is filed under a fold they have not opened. The fold is opened and
  // the document's segment selected before the fragment is applied, so a link
  // never lands in content that is not there.
  const jump: Jump = (docId, anchor) => event => {
    const destination = panelForHash(anchor);
    const doc = documents.find(candidate => candidate.id === docId);
    const needsSegment = doc ? !isOpenIn(doc, segment) : false;
    event.preventDefault();
    revealPanel(destination);
    if (doc && needsSegment) {
      setPickedSegment(
        isAside(doc) ? 'other' : needsReview(doc) ? 'review' : 'all',
      );
    }
    requestAnimationFrame(() => {
      window.location.hash = anchor;
    });
  };

  return (
    <SurfacePage>
      <SurfaceBody className='motion-safe:scroll-smooth'>
        <div className='mx-auto flex w-full max-w-[64rem] flex-col gap-4 px-4 py-6 md:px-8 md:py-8'>
          {/* Back to the register, on the sheet's own page rather than in the
              chrome — this surface is a document, and the way out of a document
              is a line at the top of it. */}
          <Button
            variant='ghost'
            size='sm'
            nativeButton={false}
            className='-ml-2 self-start text-muted-foreground print:hidden'
            render={<Link to={paths.cases} />}
          >
            <ArrowLeftIcon /> {t('detail.back')}
          </Button>

          {/* ── The sheet ── */}
          <CaseSheet
            pkg={pkg}
            view={view}
            profile={profile}
            stages={stages}
            running={running}
            failed={failed}
            stageRunning={stageRunning}
            missing={missing}
            required={required}
            settled={classified}
            onAddFiles={accepting ? goToAddFiles : null}
            onApprove={goToApproval}
            onJump={jump}
          />

          {/* ── The case file ──
              The evidence the sheet is drawn from, filed under it. Each fold
              says what is inside before it is opened, so the stack is readable
              shut; the two the inspector actually works — what wants attention,
              and the pages it was read off — open themselves.

              There is no Decision fold. The mockup this surface follows carries
              one, and this system has nothing to put in it: the inspector
              decides, off this screen, and a form that recorded a verdict would
              be this product claiming a judgement it never makes. */}
          <StagePanel
            id={PANEL.attention}
            title={t('detail.attention')}
            summary={
              pkg.report
                ? reviewCount === 0
                  ? t('detail.attention_none')
                  : t('findings.noted', { n: reviewCount })
                : t('detail.review_preparing')
            }
            open={panels[PANEL.attention] ?? (reviewCount > 0 || !pkg.report)}
            onOpenChange={open => foldPanel(PANEL.attention, open)}
          >
            {pkg.report ? (
              <Worklist report={pkg.report} pkg={pkg} onJump={jump} />
            ) : (
              <PendingReview running={running} />
            )}
          </StagePanel>

          <StagePanel
            id={PANEL.documents}
            title={t('panel.scanned')}
            summary={t('detail.docs_count', {
              d: pkg.classifiedCount,
              r: pkg.documentsCount,
            })}
            open={panels[PANEL.documents] ?? true}
            onOpenChange={open => foldPanel(PANEL.documents, open)}
          >
            {/* Ahead of the register of documents: this is what the inspector
                opened the fold for when the package is short of a paper, and a
                dropzone below sixteen entries is one nobody scrolls to.

                The published gaps come first and the batch panel second, which
                is the order the two are reached for: a named row with the button
                that answers it is what the operator is here to do, and "more
                files, answering nothing in particular" is the fallback for what
                the list does not cover. */}
            <div className='pb-8'>
              <DocumentGaps pkg={pkg} profiles={profiles ?? []} onJump={jump} />
            </div>

            <div id='add-files' className='scroll-mt-16 pb-8'>
              <AddFiles
                packageId={pkg.id}
                status={pkg.status}
                reported={pkg.report !== null}
              />
            </div>

            <section id='documents' className='scroll-mt-16'>
              {counts.all > 1 && (
                <div className='-mx-1 flex items-stretch gap-0.5 overflow-x-auto px-1'>
                  {SEGMENTS.map(seg => {
                    const active = segment === seg;
                    return (
                      <button
                        key={seg}
                        onClick={() => setPickedSegment(seg)}
                        aria-pressed={active}
                        disabled={counts[seg] === 0}
                        className={cn(
                          'relative flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 py-2 text-[0.8125rem] transition-colors',
                          'after:absolute after:inset-x-2 after:bottom-0 after:h-[2px] after:bg-transparent',
                          'disabled:pointer-events-none disabled:opacity-40',
                          active
                            ? 'font-medium text-foreground after:bg-foreground'
                            : 'text-muted-foreground hover:text-foreground',
                        )}
                      >
                        {t(SEGMENT_KEY[seg])}
                        <span
                          data-mono
                          className={cn(
                            'text-[0.6875rem] tabular-nums',
                            active
                              ? 'text-foreground/60'
                              : 'text-muted-foreground/60',
                          )}
                        >
                          {counts[seg]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <div className='mt-5 flex flex-col gap-10'>
                {pkg.files.map(file => (
                  <FileGroup
                    key={file.id}
                    file={file}
                    files={pkg.files}
                    failed={view.disposition === 'failed'}
                    segment={segment}
                    onJump={jump}
                  />
                ))}
              </div>
            </section>
          </StagePanel>

          <StagePanel
            id={PANEL.checks}
            title={t('detail.checks')}
            summary={
              pkg.crossChecks.length === 0
                ? t('checks.none')
                : unmatchedChecks === 0
                  ? t('checks.all_match')
                  : t('findings.noted', { n: unmatchedChecks })
            }
            open={panels[PANEL.checks] ?? false}
            onOpenChange={open => foldPanel(PANEL.checks, open)}
          >
            <DocumentComparisons
              checks={pkg.crossChecks}
              running={running}
              onJump={jump}
            />
          </StagePanel>

          <StagePanel
            id={PANEL.archive}
            title={t('detail.archive_comparison')}
            summary={
              pkg.registryChecks.length === 0
                ? t('registry.none')
                : unconfirmedRegistry === 0
                  ? t('registry.all_confirmed')
                  : t('findings.noted', { n: unconfirmedRegistry })
            }
            open={
              panels[PANEL.archive] ??
              pkg.standing === 'AwaitingArchiveApproval'
            }
            onOpenChange={open => foldPanel(PANEL.archive, open)}
          >
            <RegistryChecks
              checks={pkg.registryChecks}
              running={running}
              onJump={jump}
            />
            {/* Under the answers and not over them: the conclusion is drawn
                from what the register said, so it is signed at the foot of what
                was read rather than above it. */}
            <ApproveArchiveSearch pkg={pkg} />
          </StagePanel>
        </div>
      </SurfaceBody>
    </SurfacePage>
  );
}
