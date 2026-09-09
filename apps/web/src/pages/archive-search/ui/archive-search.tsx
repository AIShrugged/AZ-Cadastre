/**
 * Archive search — the first thing an operator does, and so the surface the
 * workspace opens on: ask the archive register whether the property is already
 * registered, before a packet is taken in at all.
 *
 * **The three boxes are not three search keys.** The register finds a record by
 * address and by nothing else; a name and a parcel number are things it holds
 * the record it found *against* (`AddressLookupRequest.attributes`). The form
 * says so rather than pretending otherwise — the address is the required field,
 * the other two are labelled as checks — because a search box that silently
 * does nothing is worse than one that is honest about what it is for.
 *
 * **The register answers about its own fonds and never about an application**
 * (ADR-0009). Its coverage is partial and historical, so "no record" is an
 * absence of evidence: this screen never draws it in a fault's colour and never
 * phrases it as a verdict on anybody.
 *
 * The question is deliberately not in the address bar, unlike the register's
 * own. The lookup is a POST because the address is somebody's property and has
 * no business in a URL, a query string or an access log; keeping it in the
 * address bar would put it in all three the moment the page is reloaded.
 */
import { SearchIcon, UnplugIcon } from 'lucide-react';
import { useState, type FormEvent } from 'react';

import {
  ATTRIBUTE_KEY,
  AttributeMatchMark,
  BLANK_QUERY,
  DocumentHoldingMark,
  isAskable,
  LOOKUP_KEY,
  LOOKUP_NOTE,
  LookupOutcomeGlyph,
  RECORD_FIELD_KEY,
  RECORD_FIELDS,
  toLookupRequest,
  useLookupAddressQuery,
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
import { Input } from '@/shared/ui/input';
import { Skeleton } from '@/shared/ui/skeleton';
import {
  SurfaceBody,
  SurfaceFooter,
  SurfaceHeading,
  SurfacePage,
} from '@/shared/ui/surface';
import type {
  AddressLookupRequest,
  AddressLookupResponse,
  ArchiveRecordDto,
} from '@cadastre/api-contracts/registry';

// ─── One field of the form ──────────────────────────────────────────────────
function Field({
  id,
  label,
  hint,
  value,
  placeholder,
  required,
  onChange,
}: {
  id: string;
  label: string;
  hint: string;
  value: string;
  placeholder: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className='flex min-w-0 flex-col gap-1.5'>
      <label
        htmlFor={id}
        className='text-[0.8125rem] font-medium text-foreground'
      >
        {label}
        {required && (
          <span aria-hidden className='ml-1 text-primary'>
            *
          </span>
        )}
      </label>
      <Input
        id={id}
        type='search'
        autoComplete='off'
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        className='h-9 border-input bg-background text-[0.875rem]'
      />
      <p className='text-[0.75rem] leading-snug text-muted-foreground'>
        {hint}
      </p>
    </div>
  );
}

// ─── A band of key/value pairs ──────────────────────────────────────────────
// Silence is skipped rather than drawn as an em dash: a column an area's
// register never kept is not an empty value, and printing one for it would
// report a gap in the archive as a gap in the record.
function Pairs({
  pairs,
}: {
  pairs: readonly { key: string; label: string; value: string }[];
}) {
  return (
    <dl className='grid gap-x-8 gap-y-3.5 px-4 py-4 sm:grid-cols-2 md:px-6 lg:grid-cols-3'>
      {pairs.map(pair => (
        <div key={pair.key} className='flex min-w-0 flex-col gap-0.5'>
          <dt className='register-label text-muted-foreground'>{pair.label}</dt>
          <dd
            data-mono
            className='text-[0.8125rem] break-words text-foreground'
          >
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
        <h2 className='register-label text-foreground'>{title}</h2>
        {count !== undefined && (
          <span
            data-mono
            className='rounded-full bg-muted px-1.5 text-[0.6875rem] text-muted-foreground tabular-nums'
          >
            {count}
          </span>
        )}
      </header>
      {children}
    </section>
  );
}

// ─── The consolidated answer ────────────────────────────────────────────────
// The band the eye lands on: what the register found, how it spells the address
// it found it under, and what that means — never what it means for the
// application, which is nobody's to say here.
function VerdictBand({ answer }: { answer: AddressLookupResponse }) {
  const { t } = useI18n();
  return (
    <div className='flex flex-col gap-2 border-b border-rule-strong px-4 py-4 md:flex-row md:items-center md:justify-between md:px-6'>
      <div className='flex min-w-0 flex-col gap-1.5'>
        {/* The mark and the word, once. Drawn at heading scale rather than as a
            pill beside a heading that repeats it: the answer is the heading. */}
        <div className='flex flex-wrap items-center gap-2'>
          <LookupOutcomeGlyph outcome={answer.outcome} />
          <h2 className='text-[1.0625rem] font-semibold tracking-tight text-foreground'>
            {t(LOOKUP_KEY[answer.outcome])}
          </h2>
        </div>
        <p className='text-[0.8125rem] leading-relaxed text-muted-foreground'>
          {t(LOOKUP_NOTE[answer.outcome])}
        </p>
      </div>
      <div className='flex shrink-0 flex-col gap-0.5 md:items-end'>
        {answer.canonicalAddress !== null && (
          <span className='text-[0.8125rem] text-foreground/80'>
            {t('archive.canonical')}{' '}
            <span data-mono className='text-foreground'>
              {answer.canonicalAddress}
            </span>
          </span>
        )}
        <span className='text-[0.75rem] text-muted-foreground'>
          {t('archive.candidates', { n: answer.candidates })}
        </span>
      </div>
    </div>
  );
}

// ─── The record itself ──────────────────────────────────────────────────────
function RecordPanel({ record }: { record: ArchiveRecordDto }) {
  const { t } = useI18n();
  const pairs = RECORD_FIELDS.flatMap(field => {
    const value = record[field];
    return value === null || value === ''
      ? []
      : [{ key: field, label: t(RECORD_FIELD_KEY[field]), value }];
  });

  return (
    <Panel title={t('archive.panel.record')}>
      <Pairs pairs={pairs} />
      {record.location !== null && (
        <p className='border-t border-rule px-4 py-2.5 text-[0.8125rem] text-muted-foreground md:px-6'>
          {t('archive.location')}{' '}
          <span data-mono className='text-foreground'>
            {t('archive.location.value', {
              folder: record.location.folder,
              pages: record.location.pages,
            })}
          </span>
        </p>
      )}
    </Panel>
  );
}

// ─── What the operator supplied, held against the record ────────────────────
function AttributesPanel({ answer }: { answer: AddressLookupResponse }) {
  const { t } = useI18n();
  if (answer.attributes.length === 0) return null;

  return (
    <Panel
      title={t('archive.panel.attributes')}
      count={answer.attributes.length}
    >
      <ul className='flex flex-col'>
        {answer.attributes.map(attribute => (
          <li
            key={attribute.name}
            className='flex flex-col gap-1.5 border-b border-rule px-4 py-3 last:border-b-0 md:flex-row md:items-center md:justify-between md:px-6'
          >
            <div className='flex min-w-0 flex-col gap-0.5'>
              <span className='register-label text-muted-foreground'>
                {translateOr(
                  t,
                  ATTRIBUTE_KEY[attribute.name] ?? '',
                  attribute.name,
                )}
              </span>
              <span className='flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-[0.8125rem]'>
                <span data-mono className='text-foreground'>
                  {attribute.submitted}
                </span>
                {attribute.recorded !== null && (
                  <>
                    <span className='text-muted-foreground'>
                      {t('archive.vs')}
                    </span>
                    <span data-mono className='text-foreground/80'>
                      {attribute.recorded}
                    </span>
                  </>
                )}
              </span>
            </div>
            <AttributeMatchMark match={attribute.match} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// ─── The papers the archive keeps for the property ──────────────────────────
function DocumentsPanel({ record }: { record: ArchiveRecordDto }) {
  const { t } = useI18n();
  if (record.documents.length === 0) return null;

  return (
    <Panel title={t('archive.panel.documents')} count={record.documents.length}>
      <ul className='flex flex-col'>
        {record.documents.map((document, index) => (
          <li
            key={`${document.name}-${index}`}
            className='flex flex-col gap-1.5 border-b border-rule px-4 py-3 last:border-b-0 md:flex-row md:items-start md:justify-between md:px-6'
          >
            <div className='flex min-w-0 flex-col gap-0.5'>
              {/* The register's own word for the paper, as it wrote it — a
                  document name is data and not a key this build can translate. */}
              <span className='text-[0.8125rem] font-medium text-foreground'>
                {document.name}
              </span>
              <span className='flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 text-[0.75rem] text-muted-foreground'>
                {document.number !== null && (
                  <span data-mono>{document.number}</span>
                )}
                {document.issuedOn !== null && (
                  <span data-mono>{document.issuedOn}</span>
                )}
                {document.issuingAuthority !== null && (
                  <span>{document.issuingAuthority}</span>
                )}
                {document.location !== null && (
                  <span data-mono>
                    {t('archive.location.value', {
                      folder: document.location.folder,
                      pages: document.location.pages,
                    })}
                  </span>
                )}
              </span>
            </div>
            <DocumentHoldingMark holding={document.holding} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}

// ─── Where the answer came from ─────────────────────────────────────────────
// One source, and it is named. The audit line the register wrote travels in
// English (TECH_DEBT §8) and is shown as what it is — the record of the lookup,
// not a sentence written for this reader.
function SourcePanel({ note }: { note: string }) {
  const { t } = useI18n();
  return (
    <Panel title={t('archive.panel.source')} count={1}>
      <div className='flex flex-col gap-1 px-4 py-3.5 md:px-6'>
        <span className='text-[0.8125rem] font-medium text-foreground'>
          {t('archive.source.register')}
        </span>
        <p
          data-mono
          className='text-[0.75rem] leading-relaxed break-words text-muted-foreground'
        >
          {note}
        </p>
      </div>
    </Panel>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────
export function ArchiveSearch() {
  const { t } = useI18n();
  const [query, setQuery] = useState<ArchiveQuery>(BLANK_QUERY);
  // What has actually been asked, which is not what is in the boxes. Typing is
  // not a question: the register is asked when the operator says so, and the
  // request doubles as the cache key so the same lookup twice is one call.
  const [asked, setAsked] = useState<AddressLookupRequest | null>(null);

  const {
    data: answer,
    isFetching,
    isError,
  } = useLookupAddressQuery(
    asked ?? { address: '', attributes: [], documents: [] },
    { skip: asked === null },
  );

  const askable = isAskable(query);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!askable) return;
    setAsked(toLookupRequest(query));
  }

  const field = (key: keyof ArchiveQuery) => (value: string) =>
    setQuery(current => ({ ...current, [key]: value }));

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
          className='flex shrink-0 flex-col gap-4 border-b border-rule-strong px-4 py-4 md:px-6'
        >
          <div className='grid gap-4 md:grid-cols-3'>
            <Field
              id='archive-address'
              required
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
          </div>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <p className='max-w-xl text-[0.75rem] leading-relaxed text-muted-foreground'>
              {t('search.note')}
            </p>
            <Button type='submit' disabled={!askable || isFetching}>
              <SearchIcon />
              {isFetching ? t('search.searching') : t('search.submit')}
            </Button>
          </div>
        </form>

        {/* ── The answer ── four states, each told apart from the rest: nothing
            asked yet, asking, a register that did not answer, and an answer. */}
        {asked === null ? (
          <Empty className='register-hatch flex-1 rounded-none border-0 px-6 py-20'>
            <EmptyMedia
              variant='icon'
              className='mb-0 size-12 rounded-xl border border-rule-strong bg-card text-muted-foreground shadow-[var(--shadow-sm)]'
            >
              <SearchIcon className='size-5' />
            </EmptyMedia>
            <EmptyHeader className='gap-1.5'>
              <EmptyTitle className='text-[1.0625rem] font-semibold tracking-tight text-foreground'>
                {t('search.idle.title')}
              </EmptyTitle>
              <EmptyDescription className='text-[0.875rem] leading-relaxed text-muted-foreground'>
                {t('search.idle.body')}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : isError ? (
          <Empty className='register-hatch flex-1 rounded-none border-0 px-6 py-20'>
            <EmptyMedia
              variant='icon'
              className='mb-0 size-12 rounded-xl border border-rule-strong bg-card text-muted-foreground shadow-[var(--shadow-sm)]'
            >
              <UnplugIcon className='size-5' />
            </EmptyMedia>
            <EmptyHeader className='gap-1.5'>
              <EmptyTitle className='text-[1.0625rem] font-semibold tracking-tight text-foreground'>
                {t('search.error.title')}
              </EmptyTitle>
              <EmptyDescription className='text-[0.875rem] leading-relaxed text-muted-foreground'>
                {t('search.error.body')}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
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
            <VerdictBand answer={answer} />
            {answer.record !== null && <RecordPanel record={answer.record} />}
            <AttributesPanel answer={answer} />
            {answer.record !== null && (
              <DocumentsPanel record={answer.record} />
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
