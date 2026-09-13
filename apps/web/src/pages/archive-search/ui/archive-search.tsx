/**
 * Archive search — the first thing an operator does, and so the surface the
 * workspace opens on: ask the archive register what it holds about a property,
 * before a packet is taken in at all.
 *
 * **Three boxes, three ways in.** Until COMM-56 the register could find a
 * record by address and by nothing else, and this screen said so: one required
 * field and two labelled as checks. It now searches by any of the three and
 * grades each — a surname on a paper, a parcel number read half off a plan, an
 * address spelled the way the applicant spells it. Which is what the counter
 * actually gets handed; the old form answered one question in three out of the
 * three it was asked.
 *
 * **A list of possibilities and not a verdict.** The register offers everything
 * that might be the record, says how sure it is of each, and acts on nothing —
 * so this draws a row per record with its confidence and its source, and never
 * a single answer at heading scale. The operator decides which of them is the
 * one; the screen has no opinion and no way to form one.
 *
 * **The threshold is the operator's, not the screen's.** How much doubt is
 * worth reading through depends on why somebody is searching, and the register
 * does not know why (ADR-0009). So the bar is a control, its four positions are
 * the contract's own band floors, and moving it asks the register again rather
 * than hiding rows already on screen.
 *
 * **Nothing found is not a fault** — the archive's coverage is partial and
 * historical, so an empty answer is an absence of evidence and is never drawn
 * in a fault's colour or phrased as a verdict about anybody.
 *
 * The question is deliberately not in the address bar, unlike the register's
 * own. The search is a POST because a name and an address are somebody's
 * property and have no business in a URL, a query string or an access log;
 * keeping the question in the address bar would put it in all three the moment
 * the page is reloaded.
 */
import {
  ChevronRightIcon,
  SearchIcon,
  SearchXIcon,
  UnplugIcon,
} from 'lucide-react';
import { useState, type FormEvent, type ReactNode } from 'react';

import {
  ATTRIBUTE_KEY,
  BAND_KEY,
  BLANK_QUERY,
  ConfidenceMark,
  CRITERION_KEY,
  DisputedMark,
  isAskable,
  readCriteria,
  RECORD_FIELD_KEY,
  RECORD_FIELDS,
  THRESHOLD_CHOICES,
  toSearchRequest,
  useSearchArchiveQuery,
  type ArchiveQuery,
} from '@/entities/archive-record';
import { translateOr, useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import { Button } from '@/shared/ui/button';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/shared/ui/empty';
import { InfoHint } from '@/shared/ui/info-hint';
import { Input } from '@/shared/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from '@/shared/ui/select';
import { Skeleton } from '@/shared/ui/skeleton';
import {
  SurfaceBody,
  SurfaceFooter,
  SurfaceHeading,
  SurfacePage,
} from '@/shared/ui/surface';
import { percent } from '@/shared/ui/tally';
import {
  bandOf,
  type ArchiveMatchDto,
  type ArchiveSearchRequest,
  type ArchiveSearchResponse,
  type SourceDisagreementDto,
} from '@cadastre/api-contracts/registry';

// ─── One field of the form ──────────────────────────────────────────────────
// None of the three is required and none is privileged: any one of them is a
// question the register answers, so no asterisk marks one of them as the real
// search box.
function Field({
  id,
  label,
  hint,
  value,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  const { t } = useI18n();
  return (
    <div className='flex min-w-0 flex-col gap-1.5'>
      <FieldLabel htmlFor={id} hint={hint} hintLabel={t('common.more_info')}>
        {label}
      </FieldLabel>
      <Input
        id={id}
        type='search'
        autoComplete='off'
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className='h-9 border-input bg-card text-[0.875rem]'
      />
    </div>
  );
}

/**
 * A label exactly one line tall, whether or not it carries an ⓘ, so every
 * control in the form row starts at the same height.
 *
 * How each box searches sits behind the ⓘ. It was a sentence under every box,
 * of different lengths, and the row read as three paragraphs with inputs
 * wedged between them.
 */
function FieldLabel({
  htmlFor,
  hint,
  hintLabel,
  children,
}: {
  htmlFor?: string;
  hint?: string;
  hintLabel: string;
  children: ReactNode;
}) {
  const text = 'text-[0.8125rem] font-medium text-foreground';
  return (
    <div className='flex h-6 min-w-0 items-center gap-1'>
      {htmlFor ? (
        <label htmlFor={htmlFor} className={cn('truncate', text)}>
          {children}
        </label>
      ) : (
        <span className={cn('truncate', text)}>{children}</span>
      )}
      {hint && <InfoHint label={hintLabel}>{hint}</InfoHint>}
    </div>
  );
}

// ─── A band of key/value pairs ──────────────────────────────────────────────
// Silence is skipped rather than drawn as an em dash: a column an area's
// register never kept is not an empty value, and printing one for it would
// report a gap in the archive as a gap in the record.
function Pairs({
  pairs,
  className,
}: {
  pairs: readonly { key: string; label: string; value: string }[];
  className?: string;
}) {
  return (
    <dl
      className={cn(
        'grid gap-x-8 gap-y-3.5 px-4 py-4 sm:grid-cols-2 md:px-6 lg:grid-cols-3',
        className,
      )}
    >
      {pairs.map(pair => (
        <div key={pair.key} className='flex min-w-0 flex-col gap-0.5'>
          <dt className='text-[0.75rem] text-muted-foreground'>{pair.label}</dt>
          <dd className='text-[0.875rem] break-words text-foreground'>
            {pair.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function Panel({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className='border-b border-rule'>
      <header className='flex items-center gap-2.5 border-b border-rule bg-muted/25 px-4 py-2 md:px-6'>
        <h2 className='text-[0.8125rem] font-semibold text-foreground'>
          {title}
        </h2>
        {count !== undefined && (
          <span className='rounded-full bg-muted px-1.5 text-[0.6875rem] font-medium text-muted-foreground tabular-nums'>
            {count}
          </span>
        )}
      </header>
      {children}
    </section>
  );
}

// ─── What the search covered ────────────────────────────────────────────────
// The denominator, stated. "Three matches" means nothing without how many
// records were compared and at what bar — and the register answers both, so the
// screen never has to imply either.
function CoverageBand({ answer }: { answer: ArchiveSearchResponse }) {
  const { t } = useI18n();
  const band = bandOf(answer.threshold);

  return (
    <div className='flex flex-col gap-3 border-b border-rule-strong px-4 py-4 md:px-6'>
      <div className='flex min-w-0 flex-col gap-1'>
        <h2 className='text-[1.0625rem] font-semibold tracking-tight text-foreground'>
          {t('search.matched', { n: answer.matched })}
        </h2>
        <p className='text-[0.8125rem] leading-relaxed text-muted-foreground'>
          {t('search.considered', { n: answer.considered })}{' '}
          {t('search.at_threshold', {
            band: t(BAND_KEY[band]),
            value: percent(answer.threshold),
          })}
        </p>
      </div>
      {/* One chip per source that answered, wrapping onto as many lines as it
          takes. A single line of names is a line that runs off the page the
          moment the bar is lowered and all six registers answer at once — and
          which registers answered is exactly what a lowered bar is read for. */}
      {answer.sources.length > 0 && (
        <div className='flex min-w-0 flex-col gap-1'>
          <span className='text-[0.75rem] text-muted-foreground'>
            {t('search.sources')}
          </span>
          <ul className='flex flex-wrap gap-1.5'>
            {answer.sources.map(source => (
              <li
                key={source}
                className='rounded-full bg-muted px-2 py-0.5 text-[0.75rem] break-words text-foreground'
              >
                {source}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// ─── One record the archive offers ──────────────────────────────────────────
function MatchRow({ match }: { match: ArchiveMatchDto }) {
  const { t } = useI18n();
  const { answered, silent } = readCriteria(match);
  // The address heads the row, so it is not repeated in the pairs below it.
  const pairs = RECORD_FIELDS.flatMap(field => {
    if (field === 'address') return [];
    const value = match.record[field];
    return value === null || value === ''
      ? []
      : [{ key: field, label: t(RECORD_FIELD_KEY[field]), value }];
  });

  return (
    <li className='flex flex-col border-b border-rule last:border-b-0'>
      <div className='flex flex-col gap-2 px-4 pt-3.5 md:flex-row md:items-start md:justify-between md:px-6'>
        <div className='flex min-w-0 flex-col gap-0.5'>
          <span className='text-[0.9375rem] font-medium break-words text-foreground'>
            {match.record.address}
          </span>
          <span className='text-[0.75rem] text-muted-foreground'>
            {/* The source's own name for itself, and the catalogue line it
                belongs to. Both are data the register wrote, not keys this
                build can translate. */}
            {match.source.name}
            {match.source.register !== match.source.name && (
              <span className='text-muted-foreground/70'>
                {' · '}
                {match.source.register}
              </span>
            )}
          </span>
        </div>
        <div className='flex shrink-0 flex-wrap items-center gap-2.5'>
          {match.disputed && <DisputedMark />}
          <ConfidenceMark confidence={match.confidence} />
        </div>
      </div>

      {pairs.length > 0 && <Pairs pairs={pairs} className='py-3' />}

      {/* Where to pull the file. The one line on this screen that sends the
          operator to a shelf, so it is on the row and not behind an expander —
          and it travels in the register's own wording (TECH_DEBT §8). */}
      {match.record.location !== null && (
        <p className='px-4 pb-2.5 text-[0.75rem] text-muted-foreground md:px-6'>
          {t('archive.location')}{' '}
          <span className='text-foreground'>
            {t('archive.location.value', {
              folder: match.record.location.folder,
              pages: match.record.location.pages,
            })}
          </span>
        </p>
      )}

      {/* ── What the record was graded on, and what it never spoke to ──
          Two statements and not one column with blanks in it: a criterion the
          record answered has a figure, and a criterion its register never kept
          a column for is silence — which the register left out of the average
          above, and which a zero here would misreport as a failure to match. */}
      <div className='flex flex-col gap-1.5 px-4 pb-3.5 md:px-6'>
        <div className='flex flex-wrap items-baseline gap-x-4 gap-y-1'>
          {answered.map(line => (
            <span
              key={line.criterion}
              className='inline-flex min-w-0 items-baseline gap-1.5 text-[0.75rem]'
            >
              <span className='text-muted-foreground'>
                {t(CRITERION_KEY[line.criterion])}
              </span>
              <span className='font-medium tabular-nums text-foreground'>
                {percent(line.confidence)}
              </span>
              {line.recorded !== null && (
                <span className='min-w-0 truncate text-muted-foreground'>
                  {line.recorded}
                </span>
              )}
            </span>
          ))}
        </div>
        {silent.length > 0 && (
          <p className='text-[0.75rem] leading-snug text-muted-foreground'>
            {t('search.silent_about', {
              fields: silent
                .map(line => t(CRITERION_KEY[line.criterion]))
                .join(', '),
            })}
          </p>
        )}
      </div>
    </li>
  );
}

// ─── Where two sources answer for one property and differ ───────────────────
// Quoted, never resolved. The archive is six registers kept by different
// offices over thirty years and they contradict each other by design
// (ADR-0010); which of them is right is not the register's to say and not this
// screen's. So both statements are printed side by side, in the same ink, with
// neither marked as the wrong one.
function DisagreementsPanel({
  disagreements,
}: {
  disagreements: readonly SourceDisagreementDto[];
}) {
  const { t } = useI18n();

  return (
    <Panel title={t('search.panel.disagreements')} count={disagreements.length}>
      <p className='border-b border-rule px-4 py-2.5 text-[0.75rem] leading-relaxed text-muted-foreground md:px-6'>
        {t('search.disagreements.note')}
      </p>
      <ul className='flex flex-col'>
        {disagreements.map(disagreement => (
          <li
            key={`${disagreement.subject}-${disagreement.field}`}
            className='flex flex-col gap-2 border-b border-rule px-4 py-3 last:border-b-0 md:px-6'
          >
            <div className='flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5'>
              {/* The field first and the property after it, because the
                  property is what a register may hold nothing for: the older
                  land-committee books carry a holder and no address at all,
                  and a row that led with the address would open with a blank. */}
              <span className='text-[0.75rem] text-muted-foreground'>
                {/* The register's own field name, in the reader's language
                    where this build has one — and bare where it does not, so
                    two sources contradicting each other about a column nobody
                    here has heard of is still legible. */}
                {translateOr(
                  t,
                  ATTRIBUTE_KEY[disagreement.field] ?? '',
                  disagreement.field,
                )}
              </span>
              {disagreement.subject !== '' && (
                <span className='text-[0.8125rem] font-medium text-foreground'>
                  {disagreement.subject}
                </span>
              )}
            </div>
            <ul className='flex flex-col gap-1.5'>
              {disagreement.statements.map((statement, index) => (
                <li
                  key={`${statement.source}-${index}`}
                  className='flex flex-col gap-0.5 border-l border-rule-strong pl-3 sm:flex-row sm:items-baseline sm:gap-2.5'
                >
                  <span className='shrink-0 text-[0.75rem] text-muted-foreground'>
                    {statement.source}
                  </span>
                  <span className='min-w-0 text-[0.8125rem] break-words text-foreground'>
                    {statement.value}
                  </span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// ─── Where the answer came from ─────────────────────────────────────────────
// The audit line the register wrote travels in English (TECH_DEBT §8). It is
// the record of the search, not a sentence written for this reader, so it is
// folded under "Technical details" — there for whoever needs it, and not the
// last thing every search result ends on.
function SourcePanel({ note }: { note: string }) {
  const { t } = useI18n();
  return (
    <details className='group border-b border-rule'>
      <summary className='flex cursor-pointer list-none select-none items-center gap-2 px-4 py-2.5 text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:px-6'>
        <ChevronRightIcon
          aria-hidden
          className='size-3.5 shrink-0 transition-transform duration-200 group-open:rotate-90'
        />
        {t('search.details')}
      </summary>
      <div className='flex flex-col gap-1 pr-4 pb-3.5 pl-9.5 md:pr-6 md:pl-11.5'>
        <span className='text-[0.8125rem] font-medium text-foreground'>
          {t('archive.source.register')}
        </span>
        <p className='text-[0.75rem] leading-relaxed break-words text-muted-foreground'>
          {note}
        </p>
      </div>
    </details>
  );
}

/** An empty state that states an absence, never a fault (ADR-0009). */
function Nothing({
  icon: Icon,
  title,
  body,
}: {
  icon: typeof SearchIcon;
  title: string;
  body: string;
}) {
  return (
    <Empty className='register-hatch flex-1 rounded-none border-0 px-6 py-20'>
      <EmptyMedia
        variant='icon'
        className='mb-0 size-12 rounded-xl border border-rule-strong bg-card text-muted-foreground shadow-[var(--shadow-sm)]'
      >
        <Icon className='size-5' />
      </EmptyMedia>
      <EmptyHeader className='gap-1.5'>
        <EmptyTitle className='text-[1.0625rem] font-semibold tracking-tight text-foreground'>
          {title}
        </EmptyTitle>
        <EmptyDescription className='text-[0.875rem] leading-relaxed text-muted-foreground'>
          {body}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────
export function ArchiveSearch() {
  const { t } = useI18n();
  const [query, setQuery] = useState<ArchiveQuery>(BLANK_QUERY);
  // What has actually been asked, which is not what is in the boxes. Typing is
  // not a question: the register is asked when the operator says so, and the
  // request doubles as the cache key so the same search twice is one call.
  const [asked, setAsked] = useState<ArchiveSearchRequest | null>(null);

  const {
    data: answer,
    isFetching,
    isError,
  } = useSearchArchiveQuery(asked ?? toSearchRequest(BLANK_QUERY), {
    skip: asked === null,
  });

  const askable = isAskable(query);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!askable) return;
    setAsked(toSearchRequest(query));
  }

  const field = (key: 'name' | 'address' | 'parcel') => (value: string) =>
    setQuery(current => ({ ...current, [key]: value }));

  /*
   * The bar moves and the register is asked again, without waiting for the
   * button — the control has one meaning and the list under it must agree with
   * where it stands. Only once something has been asked: moving the bar on an
   * empty form is setting up a question, not putting one.
   */
  function onThreshold(threshold: number) {
    const moved = { ...query, threshold };
    setQuery(moved);
    if (asked !== null && isAskable(moved)) setAsked(toSearchRequest(moved));
  }

  return (
    <SurfacePage>
      <SurfaceHeading
        title={t('page.search.title')}
        subtitle={t('page.search.subtitle')}
      />

      <SurfaceBody>
        {/* ── The question ── */}
        <form
          onSubmit={onSubmit}
          className='shrink-0 border-b border-rule-strong px-4 py-5 md:px-6'
        >
          {/* One row on a wide screen — the three boxes, the bar and the
              button, bottom-aligned so every control sits on one line — two
              columns on a tablet, one on a phone. */}
          <div className='grid items-end gap-x-3 gap-y-4 md:grid-cols-2 xl:grid-cols-[repeat(3,minmax(0,1fr))_11rem_auto]'>
            <Field
              id='archive-address'
              label={t('search.field.address')}
              hint={t('search.field.address_hint')}
              placeholder={t('search.field.address_placeholder')}
              value={query.address}
              onChange={field('address')}
            />
            <Field
              id='archive-name'
              label={t('search.field.name')}
              hint={t('search.field.name_hint')}
              placeholder={t('search.field.name_placeholder')}
              value={query.name}
              onChange={field('name')}
            />
            <Field
              id='archive-parcel'
              label={t('search.field.parcel')}
              hint={t('search.field.parcel_hint')}
              placeholder={t('search.field.parcel_placeholder')}
              value={query.parcel}
              onChange={field('parcel')}
            />

            {/* "Minimum match" — the operator's own bar, offered at the
                contract's four band floors and not on a scale this screen
                invented. Labelled above like the boxes, so the row aligns. */}
            <div className='flex min-w-0 flex-col gap-1.5'>
              <FieldLabel hintLabel={t('common.more_info')}>
                {t('search.threshold.label')}
              </FieldLabel>
              <Select
                value={String(query.threshold)}
                onValueChange={value => onThreshold(Number(value))}
              >
                <SelectTrigger
                  aria-label={t('search.threshold.label')}
                  className='h-9 w-full gap-2 border-input bg-card px-2.5 text-[0.875rem] text-foreground hover:bg-accent hover:text-foreground data-[size=default]:h-9'
                >
                  <span className='truncate'>
                    {t(BAND_KEY[bandOf(query.threshold)])}
                  </span>
                </SelectTrigger>
                <SelectContent align='start'>
                  {THRESHOLD_CHOICES.map(choice => (
                    <SelectItem key={choice.band} value={String(choice.floor)}>
                      <span className='flex items-baseline gap-2'>
                        {t(BAND_KEY[choice.band])}
                        <span className='text-[0.75rem] tabular-nums text-muted-foreground'>
                          {percent(choice.floor)}
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* That one box is enough is said by the empty state below, and
                by the button, which lights the moment any box has text. */}
            <Button
              type='submit'
              className='h-9 w-full px-5 md:col-span-2 xl:col-span-1 xl:w-auto'
              disabled={!askable || isFetching}
            >
              <SearchIcon />
              {isFetching ? t('search.searching') : t('search.submit')}
            </Button>
          </div>
        </form>

        {/* ── The answer ── five states, each told apart from the rest: nothing
            asked yet, asking, a register that did not answer, a register that
            answered with nothing, and records. */}
        {asked === null ? (
          <Nothing
            icon={SearchIcon}
            title={t('search.idle.title')}
            body={t('search.idle.body')}
          />
        ) : isError ? (
          <Nothing
            icon={UnplugIcon}
            title={t('search.error.title')}
            body={t('search.error.body')}
          />
        ) : answer === undefined ? (
          <div
            className='flex flex-col gap-3 px-4 py-6 md:px-6'
            aria-busy='true'
            aria-live='polite'
          >
            <Skeleton className='h-6 w-64' />
            <Skeleton className='h-3.5 w-96' />
            <Skeleton className='h-40 w-full' />
          </div>
        ) : (
          <div
            className={cn(
              'flex flex-col transition-opacity',
              isFetching && 'opacity-60',
            )}
          >
            <CoverageBand answer={answer} />
            {answer.disagreements.length > 0 && (
              <DisagreementsPanel disagreements={answer.disagreements} />
            )}
            {answer.matches.length === 0 ? (
              <Nothing
                icon={SearchXIcon}
                title={t('search.none.title')}
                body={t('search.none.body')}
              />
            ) : (
              <Panel title={t('search.panel.matches')} count={answer.matched}>
                <ul className='flex flex-col'>
                  {answer.matches.map(match => (
                    <MatchRow
                      key={`${match.source.name}-${match.record.registerNo}`}
                      match={match}
                    />
                  ))}
                </ul>
                {/* A page and not the whole answer. Said plainly rather than
                    paged: narrowing the question is the honest way to see the
                    rest of it, and a "next page" of possibilities would invite
                    reading the archive instead of searching it. */}
                {answer.matched > answer.matches.length && (
                  <p className='border-t border-rule px-4 py-2.5 text-[0.75rem] text-muted-foreground md:px-6'>
                    {t('search.more', {
                      shown: answer.matches.length,
                      n: answer.matched,
                    })}
                  </p>
                )}
              </Panel>
            )}
            <SourcePanel note={answer.note} />
          </div>
        )}
      </SurfaceBody>

      <SurfaceFooter>
        <p className='text-[0.8125rem] leading-snug text-muted-foreground'>
          {t('search.footer')}
        </p>
      </SurfaceFooter>
    </SurfacePage>
  );
}
