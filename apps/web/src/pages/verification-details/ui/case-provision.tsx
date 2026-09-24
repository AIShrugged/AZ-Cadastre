/**
 * Which provision of Article 8 the case falls under, and why — the six figures
 * it was decided on and where each came from, what each possible provision asks
 * the package for, the titles to the land and the dates they are held to
 * (ADR-0025).
 *
 * Everything here is the server's answer, drawn as it arrived. The decision
 * table is the customer's acceptance contract and the decision stays with the
 * inspector: the panel says what the engine concluded and on what, so a figure
 * read wrongly is a figure the inspector can see and open.
 *
 * **One table for what the provisions ask for.** It was a list per provision
 * and then a decision table naming the same provisions again, then a card per
 * provision that repeated the title to the land, "Not determined" and the
 * figures in every card. The table names each paper once and lets the pattern
 * of glyphs show where provisions differ; a provision's condition is behind
 * the ⓘ on its column.
 */
import {
  CheckIcon,
  ChevronRightIcon,
  CircleHelpIcon,
  MinusIcon,
} from 'lucide-react';

import {
  chainLine,
  fieldAnchor,
  provisionName,
  provisionSummary,
  spanPhrase,
  spanWithinLimit,
  unitLine,
  type ProfileDto,
} from '@/entities/verification-package';
import { formatDate, translateOr, useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import type { Jump } from '@/shared/lib/jump';
import { InfoHint } from '@/shared/ui/info-hint';
import type {
  CaseParameterDto,
  CaseProvisionDto,
  ProvisionRequirementDto,
  SpanCalculationDto,
  TitleDocumentStandingDto,
} from '@cadastre/api-contracts/verification';

type Translate = (
  key: string,
  vars?: Record<string, string | number>,
) => string;

type Mark = 'yes' | 'no' | 'open';

type ProvisionRule = CaseProvisionDto['rules'][number];

const MARK_ICON = {
  yes: CheckIcon,
  no: MinusIcon,
  open: CircleHelpIcon,
} as const;

// The word carries the state and the colour only repeats it, the rule every
// disposition on this surface is drawn by.
const MARK_INK: Record<Mark, string> = {
  yes: 'text-ok-ink',
  no: 'text-incomplete-ink',
  open: 'text-issues-ink',
};

const MARK_TINT: Record<Mark, string> = {
  yes: 'bg-ok/12 text-ok-ink',
  no: 'bg-incomplete/12 text-incomplete-ink',
  open: 'bg-issues/14 text-issues-ink',
};

function MarkedLine({ mark, label }: { mark: Mark; label: string }) {
  const Icon = MARK_ICON[mark];

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-baseline gap-1.5 text-[0.75rem] font-medium',
        MARK_INK[mark],
      )}
    >
      <Icon aria-hidden className='size-3 shrink-0 translate-y-0.5' />
      {label}
    </span>
  );
}

/** The state as a glyph, its word kept for a screen reader and a hover. */
function MarkGlyph({ mark, label }: { mark: Mark; label: string }) {
  const Icon = MARK_ICON[mark];

  return (
    <span
      title={label}
      className={cn(
        'inline-grid size-5 shrink-0 place-items-center rounded-full',
        MARK_TINT[mark],
      )}
    >
      <Icon aria-hidden className='size-3' strokeWidth={2.5} />
      <span className='sr-only'>{label}</span>
    </span>
  );
}

function docLabel(t: Translate, type: string): string {
  return translateOr(t, `doctype.${type}`, type);
}

function SubHeading({ children, hint }: { children: string; hint?: string }) {
  const { t } = useI18n();

  return (
    <h3 className='flex items-center gap-1 text-[0.875rem] font-semibold tracking-[-0.01em] text-foreground'>
      {children}
      {hint && <InfoHint label={t('common.more_info')}>{hint}</InfoHint>}
    </h3>
  );
}

export function CaseProvisionPanel({
  provision,
  profile,
  onJump,
}: {
  provision: CaseProvisionDto;
  /** Null while the profiles load; the sources of the papers are then left
   *  unsaid rather than guessed. */
  profile: ProfileDto | null;
  onJump: Jump;
}) {
  const { t } = useI18n();

  return (
    <section id='provision' className='scroll-mt-16'>
      <div className='flex items-start gap-1'>
        <p
          className={cn(
            'text-[0.9375rem] font-[550] leading-snug',
            provision.outcome === 'Determined'
              ? 'text-foreground'
              : 'text-incomplete-ink',
          )}
        >
          {provisionSummary(t, provision)}
        </p>
        <InfoHint label={t('common.more_info')} className='-mt-0.5'>
          {t('provision.lead')}
        </InfoHint>
      </div>
      <Parameters provision={provision} onJump={onJump} />

      <Options provision={provision} profile={profile} />

      {provision.titleDocuments.length > 0 && (
        <Titles titles={provision.titleDocuments} onJump={onJump} />
      )}
    </section>
  );
}

// ─── The six figures ──────────────────────────────────────────────────────────

function Parameters({
  provision,
  onJump,
}: {
  provision: CaseProvisionDto;
  onJump: Jump;
}) {
  const { t } = useI18n();
  const parameters = provision.parameters;

  return (
    <div className='mt-6'>
      <SubHeading>{t('provision.parameters')}</SubHeading>
      {/* A grid of six rather than six full-width rows: each figure is a word
          or two, and a row the width of the page put its value half a screen
          away from its name. */}
      <dl className='mt-2.5 grid gap-px overflow-hidden rounded-lg border border-rule bg-rule sm:grid-cols-2 lg:grid-cols-3'>
        {parameters.map(parameter => (
          <div
            key={parameter.parameter}
            className='flex min-w-0 flex-col gap-0.5 bg-card px-3.5 py-2.5'
          >
            <dt className='text-[0.75rem] leading-snug text-muted-foreground'>
              {translateOr(
                t,
                `provision.param.${parameter.parameter}`,
                parameter.parameter,
              )}
            </dt>
            <dd className='text-[0.875rem] leading-snug text-foreground'>
              <ParameterValue parameter={parameter} />
            </dd>
            {parameter.calculation && (
              <dd className='text-[0.75rem] leading-snug text-muted-foreground'>
                <SpanWorking
                  calculation={parameter.calculation}
                  withinLimit={spanWithinLimit(provision)}
                />
              </dd>
            )}
            {parameter.source !== null && (
              <dd className='text-[0.75rem] leading-snug text-muted-foreground'>
                <ParameterSource parameter={parameter} onJump={onJump} />
              </dd>
            )}
          </div>
        ))}
      </dl>
    </div>
  );
}

function ParameterValue({ parameter }: { parameter: CaseParameterDto }) {
  const { t, locale } = useI18n();

  if (parameter.value === null) {
    // A reading refused is not a reading missing: the words that could not be
    // understood are shown, so the inspector knows which sheet to open.
    return (
      <span className='text-incomplete-ink'>
        {parameter.stated === null
          ? t('provision.not_established')
          : t('provision.stated_refused', { stated: parameter.stated })}
      </span>
    );
  }

  // The span says which two axes it lies between: a bare "5.2" is a figure the
  // inspector cannot find on the plan (ADR-0043).
  if (parameter.calculation) {
    return (
      <span className='tabular-nums'>
        {spanPhrase(t, parameter.calculation, locale)}
      </span>
    );
  }

  return typeof parameter.value === 'number' ? (
    <span className='tabular-nums'>{parameter.value}</span>
  ) : (
    <>{translateOr(t, `provision.value.${parameter.value}`, parameter.value)}</>
  );
}

/**
 * How the span was calculated, folded: every span of each chain, the unit the
 * figures were read in and why, and what was set aside as a room or an overall
 * dimension. The fold's own line says whether the longest is within the limit,
 * because that is the one thing the figure is read for (ADR-0043).
 *
 * Exported for the document card and the sheet, which state the same
 * calculation beside the line it was read off and in the report.
 */
export function SpanWorking({
  calculation,
  withinLimit,
}: {
  calculation: SpanCalculationDto;
  withinLimit: boolean | null;
}) {
  const { t, locale } = useI18n();

  return (
    <details className='group/span'>
      <summary className='flex cursor-pointer list-none items-center gap-1 select-none hover:text-foreground'>
        <ChevronRightIcon
          aria-hidden
          className='size-3 shrink-0 transition-transform group-open/span:rotate-90'
        />
        {withinLimit === null ? (
          t('span.title')
        ) : (
          <span className={withinLimit ? 'text-ok-ink' : 'text-incomplete-ink'}>
            {t(withinLimit ? 'span.limit.holds' : 'span.limit.fails')}
          </span>
        )}
      </summary>
      <div className='mt-1 flex flex-col gap-0.5 pl-4'>
        {calculation.chains.map(chain => (
          <p key={chain.chain} className='tabular-nums'>
            {t(`span.chain.${chain.chain}`)}: {chainLine(chain, locale)}
          </p>
        ))}
        <p>{unitLine(t, calculation)}</p>
        {calculation.setAside.length > 0 && (
          <p>
            {t('span.set_aside', { list: calculation.setAside.join('; ') })}
          </p>
        )}
        <p className='opacity-80'>{t('span.rule')}</p>
      </div>
    </details>
  );
}

function ParameterSource({
  parameter,
  onJump,
}: {
  parameter: CaseParameterDto;
  onJump: Jump;
}) {
  const { t } = useI18n();
  const from = parameter.from;

  if (parameter.source === null) return null;
  if (parameter.source === 'DeclaredAtIntake' || from === null) {
    return <>{t('provision.from.DeclaredAtIntake')}</>;
  }

  const document = docLabel(t, from.documentType);
  const label =
    parameter.source === 'TitleDocumentType'
      ? t('provision.from.TitleDocumentType', { document })
      : t('provision.from.ReadOffDocument', { document });
  const anchor = from.fieldName
    ? fieldAnchor(from.documentId, from.fieldName)
    : `#doc-${from.documentId}`;
  const sheet =
    from.pageNumber === null
      ? ''
      : ` · ${t('detail.page_single', { n: from.pageNumber })}`;

  return (
    <a
      href={anchor}
      onClick={onJump(from.documentId, anchor)}
      className='underline-offset-2 hover:text-foreground hover:underline'
    >
      {label}
      {sheet}
    </a>
  );
}

// ─── The provisions it could be, and what each asks for ──────────────────────

type Cell = { mark: Mark; state: string };

type MatrixRow = {
  key: string;
  label: string;
  /** The full name, where the row is labelled short, and where the policy
   *  expects the paper from — said on hover, not on the row. */
  detail?: string;
  cells: Map<string, Cell>;
};

/**
 * What each possible provision asks for, as one table: papers down, provisions
 * across, a glyph where a provision asks for a paper.
 *
 * It was a card per provision, and every card said the same things again — the
 * title to the land in full, "Not determined", the figures it depends on, the
 * committee a permit comes from. On an open case that was five blocks of prose
 * whose only difference was a row or two. As a table each paper is named once,
 * the difference between provisions is the pattern of glyphs, and what a
 * provision is — its condition and the figures it waits on — sits behind the ⓘ
 * on its column.
 */
function Options({
  provision,
  profile,
}: {
  provision: CaseProvisionDto;
  profile: ProfileDto | null;
}) {
  const { t } = useI18n();
  // The provisions still in play: the one that applies, or every candidate
  // while it is open. The rest were ruled out and fold away below the table.
  // With nothing in play every rule is a column, so the table is never empty.
  const named = new Set(
    provision.provision ? [provision.provision] : provision.candidates,
  );
  const inPlay = provision.rules.filter(rule => named.has(rule.provision));
  const columns = inPlay.length > 0 ? inPlay : provision.rules;
  const ruledOut =
    inPlay.length > 0
      ? provision.rules.filter(rule => !named.has(rule.provision))
      : [];
  // A standing whose rule the table does not carry is still a column, so
  // nothing the server sent is lost to the layout.
  const codes = [
    ...columns.map(rule => rule.provision),
    ...provision.provisions
      .map(standing => standing.provision)
      .filter(code => !provision.rules.some(rule => rule.provision === code)),
  ];

  const titled = provision.titleDocuments.length > 0;
  const rows: MatrixRow[] = [];
  const rowFor = (key: string, label: string, detail?: string) => {
    let row = rows.find(candidate => candidate.key === key);
    if (!row) {
      row = { key, label, detail, cells: new Map() };
      rows.push(row);
    }
    return row;
  };
  // Every provision asks for a title to the land (Article 10.2.1), and any of
  // the titles answers it — so it is the first row, named short.
  const title = rowFor(
    'title',
    t('provision.req.title_short'),
    t('provision.req.title'),
  );

  for (const code of codes) {
    const standing = provision.provisions.find(
      candidate => candidate.provision === code,
    );
    if (!standing) continue;

    title.cells.set(code, {
      mark: titled ? 'yes' : 'no',
      state: t(titled ? 'provision.req.answered' : 'provision.req.missing'),
    });
    for (const requirement of standing.requirements) {
      rowFor(
        requirement.anyOf.join('|'),
        requirement.anyOf
          .map(type => docLabel(t, type))
          .join(` ${t('common.or')} `),
        sourcesOf(t, requirement, profile),
      ).cells.set(code, requirementState(t, requirement));
    }
  }

  const conditionOf = (rule: ProvisionRule) => {
    const decisive = rule.conditions
      .filter(condition => condition.holds !== true)
      .map(condition =>
        translateOr(
          t,
          `provision.param.${condition.parameter}`,
          condition.parameter,
        ),
      );
    return (
      <>
        <span>
          {translateOr(t, `provision.rule.${rule.provision}`, rule.description)}
        </span>
        {decisive.length > 0 && (
          <span className='opacity-80'>
            {t(
              rule.excluded ? 'provision.rule.fails' : 'provision.rule.depends',
              { list: decisive.join(', ') },
            )}
          </span>
        )}
      </>
    );
  };

  return (
    <div className='mt-7'>
      <div className='flex flex-wrap items-center gap-x-4 gap-y-2'>
        <SubHeading hint={t('provision.rules')}>
          {t('provision.options')}
        </SubHeading>
        <span className='ml-auto flex flex-wrap items-center gap-x-3.5 gap-y-1'>
          {(
            [
              ['yes', 'provision.req.answered'],
              ['no', 'provision.req.missing'],
              ['open', 'provision.rule.open'],
            ] as const
          ).map(([mark, key]) => (
            <span
              key={mark}
              className='inline-flex items-center gap-1.5 text-[0.75rem] text-muted-foreground'
            >
              <MarkGlyph mark={mark} label={t(key)} />
              {t(key)}
            </span>
          ))}
          <span className='inline-flex items-center gap-1.5 text-[0.75rem] text-muted-foreground'>
            <NotAsked label={t('provision.req.not_asked')} />
            {t('provision.req.not_asked')}
          </span>
        </span>
      </div>

      {/* Its own horizontal scroll on a phone: five provision columns do not
          fit 400px, and a table that wraps its glyphs is no longer a table. */}
      <div className='mt-3 overflow-x-auto rounded-lg border border-rule'>
        <table className='w-full min-w-[40rem] border-collapse text-[0.8125rem]'>
          <thead>
            <tr className='border-b border-rule bg-muted'>
              <th
                scope='col'
                className='sticky left-0 z-[1] bg-muted px-3.5 py-2 text-left text-[0.75rem] font-normal text-muted-foreground'
              >
                {t('provision.col.document')}
              </th>
              {codes.map(code => {
                const rule = columns.find(
                  candidate => candidate.provision === code,
                );
                return (
                  <th
                    key={code}
                    scope='col'
                    className={cn(
                      'px-2 py-2 text-center align-bottom font-semibold',
                      rule?.holds ? 'text-ok-ink' : 'text-foreground',
                    )}
                  >
                    <span className='inline-flex items-start justify-center gap-0.5'>
                      <span className='flex flex-col items-center leading-tight'>
                        {provisionName(t, code)
                          .split(' · ')
                          .map(part => (
                            <span
                              key={part}
                              className='text-[0.75rem] font-medium whitespace-nowrap'
                            >
                              {part}
                            </span>
                          ))}
                        <span className='mt-0.5 text-[0.6875rem] font-normal tabular-nums text-muted-foreground'>
                          {code}
                        </span>
                      </span>
                      {rule && (
                        <InfoHint label={t('common.more_info')}>
                          {conditionOf(rule)}
                        </InfoHint>
                      )}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.key} className='border-b border-rule last:border-0'>
                <th
                  scope='row'
                  title={row.detail}
                  className='sticky left-0 z-[1] min-w-[9rem] bg-card px-3.5 py-2 text-left font-normal leading-snug text-foreground'
                >
                  {row.label}
                </th>
                {codes.map(code => {
                  const cell = row.cells.get(code);
                  return (
                    <td key={code} className='px-1.5 py-2 text-center'>
                      {cell ? (
                        <MarkGlyph mark={cell.mark} label={cell.state} />
                      ) : (
                        <NotAsked label={t('provision.req.not_asked')} />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {ruledOut.length > 0 && (
        <details className='group mt-3'>
          <summary className='flex cursor-pointer list-none select-none items-center gap-2 py-1 text-[0.8125rem] text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50'>
            <ChevronRightIcon
              aria-hidden
              className='size-3.5 shrink-0 transition-transform duration-200 group-open:rotate-90'
            />
            {t('provision.others', { n: ruledOut.length })}
          </summary>
          <ul className='mt-1 flex flex-col pl-5.5'>
            {ruledOut.map(rule => (
              <li
                key={rule.provision}
                className='flex gap-3 py-1 text-[0.8125rem] leading-snug text-muted-foreground'
              >
                <span className='w-16 shrink-0 font-medium tabular-nums text-foreground'>
                  {rule.provision}
                </span>
                <span className='min-w-0'>
                  {translateOr(
                    t,
                    `provision.rule.${rule.provision}`,
                    rule.description,
                  )}
                </span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/** A provision that does not ask for this paper: a quiet dot, said in words to
 *  a screen reader so an empty cell is never read as a missing answer. */
function NotAsked({ label }: { label: string }) {
  return (
    <span
      title={label}
      className='inline-grid size-5 place-items-center text-muted-foreground/45'
    >
      <span aria-hidden className='size-1 rounded-full bg-current' />
      <span className='sr-only'>{label}</span>
    </span>
  );
}

function requirementState(
  t: Translate,
  requirement: ProvisionRequirementDto,
): { mark: Mark; state: string } {
  if (requirement.applies === false) {
    return {
      mark: 'open',
      state: t('provision.req.via_integration', {
        year: requirement.onlyBuiltBefore ?? '',
      }),
    };
  }
  if (requirement.applies === null) {
    return {
      mark: 'open',
      state: t('provision.req.year_unknown', {
        year: requirement.onlyBuiltBefore ?? '',
      }),
    };
  }

  return requirement.answered
    ? { mark: 'yes', state: t('provision.req.answered') }
    : { mark: 'no', state: t('provision.req.missing') };
}

// Where the policy expects the papers of a group to come from, where that is a
// state system rather than the envelope — the source column of the acceptance
// contract's document table.
function sourcesOf(
  t: Translate,
  requirement: ProvisionRequirementDto,
  profile: ProfileDto | null,
): string | undefined {
  const sources = [
    ...new Set(
      requirement.anyOf.flatMap(type => {
        const source = profile?.documentTypes.find(
          candidate => candidate.key === type,
        )?.source;

        return source && source !== 'Package' ? [source] : [];
      }),
    ),
  ];

  return sources.length > 0
    ? sources
        .map(source => translateOr(t, `source.${source}`, source))
        .join(', ')
    : undefined;
}

// ─── The titles to the land ───────────────────────────────────────────────────

function Titles({
  titles,
  onJump,
}: {
  titles: readonly TitleDocumentStandingDto[];
  onJump: Jump;
}) {
  const { t, locale } = useI18n();

  const windowOf = (item: TitleDocumentStandingDto['items'][number]) => {
    const from = item.issuedFrom && formatDate(item.issuedFrom, locale);
    const before = item.issuedBefore && formatDate(item.issuedBefore, locale);

    if (from && before) return t('provision.window.between', { from, before });
    if (from) return t('provision.window.from', { date: from });
    if (before) return t('provision.window.before', { date: before });

    return t('provision.window.any');
  };

  return (
    <div className='mt-7'>
      <SubHeading>{t('provision.titles')}</SubHeading>
      <ul className='mt-2 border-t border-rule'>
        {titles.map(title => {
          const anchor = title.dated
            ? fieldAnchor(title.documentId, title.dated.fieldName)
            : `#doc-${title.documentId}`;
          const mark: Mark =
            title.withinWindow === true
              ? 'yes'
              : title.withinWindow === false
                ? 'no'
                : 'open';

          return (
            <li key={title.documentId} className='border-b border-rule py-2.5'>
              <div className='flex flex-wrap items-baseline gap-x-4 gap-y-0.5'>
                <a
                  href={anchor}
                  onClick={onJump(title.documentId, anchor)}
                  className='min-w-0 flex-1 text-[0.875rem] text-foreground underline-offset-2 hover:underline'
                >
                  {docLabel(t, title.documentType)}
                  {title.dated && (
                    <span className='ml-2 text-[0.75rem] tabular-nums text-muted-foreground'>
                      {title.dated.value}
                    </span>
                  )}
                </a>
                <MarkedLine
                  mark={mark}
                  label={t(
                    mark === 'yes'
                      ? 'provision.title.within'
                      : mark === 'no'
                        ? 'provision.title.outside'
                        : 'provision.title.unknown',
                  )}
                />
              </div>
              <p className='mt-1 text-[0.75rem] text-muted-foreground'>
                {title.items
                  .map(
                    item =>
                      `${t('provision.item', { item: item.item })}: ${windowOf(item)}`,
                  )
                  .join(' · ')}
                {/* A title whose kind confers no right — the order allotting
                    the parcel — names none here (ADR-0026). */}
                {title.landRight &&
                  ` · ${translateOr(t, `provision.value.${title.landRight}`, title.landRight)}`}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
