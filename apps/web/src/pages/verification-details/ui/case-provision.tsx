/**
 * Which provision of Article 8 the case falls under, and why — the six figures
 * it was decided on and where each came from, what the provision asks the
 * package for, the titles to the land and the dates they are held to, and the
 * decision table the case was read into (ADR-0025).
 *
 * Everything here is the server's answer, drawn as it arrived. The table is the
 * customer's acceptance contract and the decision stays with the inspector: the
 * panel says what the engine concluded and on what, so a figure read wrongly is
 * a figure the inspector can see and open.
 */
import { CheckIcon, CircleHelpIcon, MinusIcon } from 'lucide-react';

import {
  fieldAnchor,
  provisionSummary,
  type ProfileDto,
} from '@/entities/verification-package';
import { formatDate, translateOr, useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import type { Jump } from '@/shared/lib/jump';
import type {
  CaseParameterDto,
  CaseProvisionDto,
  ProvisionRequirementDto,
  ProvisionStandingDto,
  TitleDocumentStandingDto,
} from '@cadastre/api-contracts/verification';

type Translate = (
  key: string,
  vars?: Record<string, string | number>,
) => string;

type Mark = 'yes' | 'no' | 'open';

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

function MarkedLine({ mark, label }: { mark: Mark; label: string }) {
  const Icon = MARK_ICON[mark];

  return (
    <span
      className={cn(
        'inline-flex items-baseline gap-1.5 text-[0.75rem]',
        MARK_INK[mark],
      )}
    >
      <Icon aria-hidden className='size-3 shrink-0 translate-y-0.5' />
      {label}
    </span>
  );
}

function docLabel(t: Translate, type: string): string {
  return translateOr(t, `doctype.${type}`, type);
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
      <p className='max-w-[70ch] text-[0.8125rem] leading-relaxed text-muted-foreground'>
        {t('provision.lead')}
      </p>

      <p
        className={cn(
          'mt-4 text-[0.9375rem] font-[550] leading-snug',
          provision.outcome === 'Determined'
            ? 'text-foreground'
            : 'text-incomplete-ink',
        )}
      >
        {provisionSummary(t, provision)}
      </p>
      {provision.provision && (
        <p className='mt-1 max-w-[70ch] text-[0.8125rem] leading-snug text-muted-foreground'>
          {translateOr(
            t,
            `provision.rule.${provision.provision}`,
            provision.provision,
          )}
        </p>
      )}

      <Parameters parameters={provision.parameters} onJump={onJump} />

      {provision.provisions.map(standing => (
        <Requirements
          key={standing.provision}
          standing={standing}
          titled={provision.titleDocuments.length > 0}
          profile={profile}
        />
      ))}

      {provision.titleDocuments.length > 0 && (
        <Titles titles={provision.titleDocuments} onJump={onJump} />
      )}

      <Rules provision={provision} />
    </section>
  );
}

// ─── The six figures ──────────────────────────────────────────────────────────

function Parameters({
  parameters,
  onJump,
}: {
  parameters: readonly CaseParameterDto[];
  onJump: Jump;
}) {
  const { t } = useI18n();

  return (
    <div className='mt-6'>
      <h3 className='register-label'>{t('provision.parameters')}</h3>
      <dl className='mt-2 border-t border-rule'>
        {parameters.map(parameter => (
          <div
            key={parameter.parameter}
            className='flex flex-wrap items-baseline gap-x-4 gap-y-0.5 border-b border-rule py-2'
          >
            <dt className='w-[14rem] shrink-0 text-[0.8125rem] text-muted-foreground'>
              {translateOr(
                t,
                `provision.param.${parameter.parameter}`,
                parameter.parameter,
              )}
            </dt>
            <dd className='min-w-0 flex-1 text-[0.875rem] text-foreground'>
              <ParameterValue parameter={parameter} />
            </dd>
            <dd className='min-w-0 text-[0.75rem] text-muted-foreground'>
              <ParameterSource parameter={parameter} onJump={onJump} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ParameterValue({ parameter }: { parameter: CaseParameterDto }) {
  const { t } = useI18n();

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

  return typeof parameter.value === 'number' ? (
    <span data-mono className='tabular-nums'>
      {parameter.value}
    </span>
  ) : (
    <>{translateOr(t, `provision.value.${parameter.value}`, parameter.value)}</>
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

// ─── What the provision asks for ──────────────────────────────────────────────

function Requirements({
  standing,
  titled,
  profile,
}: {
  standing: ProvisionStandingDto;
  titled: boolean;
  profile: ProfileDto | null;
}) {
  const { t } = useI18n();

  return (
    <div className='mt-6'>
      <h3 className='register-label'>
        {t('provision.requirements', { provision: standing.provision })}
      </h3>
      <ul className='mt-2 border-t border-rule'>
        {/* Every provision asks for a title to the land (Article 10.2.1), and
            any of the titles answers it. */}
        <RequirementRow
          label={t('provision.req.title')}
          mark={titled ? 'yes' : 'no'}
          state={t(titled ? 'provision.req.answered' : 'provision.req.missing')}
        />
        {standing.requirements.length === 0 && (
          <li className='border-b border-rule py-2 text-[0.8125rem] text-muted-foreground'>
            {t('provision.req.nothing_more')}
          </li>
        )}
        {standing.requirements.map(requirement => (
          <RequirementRow
            key={requirement.anyOf.join('|')}
            label={requirement.anyOf
              .map(type => docLabel(t, type))
              .join(` ${t('common.or')} `)}
            source={sourcesOf(t, requirement, profile)}
            {...requirementState(t, requirement)}
          />
        ))}
      </ul>
    </div>
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

function RequirementRow({
  label,
  source,
  mark,
  state,
}: {
  label: string;
  source?: string;
  mark: Mark;
  state: string;
}) {
  return (
    <li className='flex flex-wrap items-baseline gap-x-4 gap-y-0.5 border-b border-rule py-2'>
      <span className='min-w-0 flex-1 text-[0.875rem] text-foreground'>
        {label}
        {source && (
          <span className='ml-2 text-[0.75rem] text-muted-foreground'>
            {source}
          </span>
        )}
      </span>
      <MarkedLine mark={mark} label={state} />
    </li>
  );
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
    <div className='mt-6'>
      <h3 className='register-label'>{t('provision.titles')}</h3>
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
                    <span
                      data-mono
                      className='ml-2 text-[0.75rem] tabular-nums text-muted-foreground'
                    >
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
                {' · '}
                {translateOr(
                  t,
                  `provision.value.${title.landRight}`,
                  title.landRight,
                )}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── The decision table ───────────────────────────────────────────────────────

function Rules({ provision }: { provision: CaseProvisionDto }) {
  const { t } = useI18n();
  const named = new Set(
    provision.provision ? [provision.provision] : provision.candidates,
  );

  return (
    <div className='mt-6'>
      <h3 className='register-label'>{t('provision.rules')}</h3>
      <ol className='mt-2 border-t border-rule'>
        {provision.rules.map(rule => {
          const mark: Mark = rule.holds ? 'yes' : rule.excluded ? 'no' : 'open';
          // The figures that ruled a row out or left it undecided — what an
          // inspector checks first when the answer looks wrong.
          const decisive = rule.conditions.filter(
            condition => condition.holds !== true,
          );

          return (
            <li
              key={rule.provision}
              className={cn(
                'flex flex-wrap items-baseline gap-x-4 gap-y-0.5 border-b border-rule py-2',
                named.has(rule.provision) && 'bg-foreground/4',
              )}
            >
              <span
                data-mono
                className='w-[5.5rem] shrink-0 text-[0.8125rem] tabular-nums text-foreground'
              >
                {rule.provision}
              </span>
              <span className='min-w-0 flex-1 text-[0.8125rem] text-foreground'>
                {translateOr(
                  t,
                  `provision.rule.${rule.provision}`,
                  rule.description,
                )}
                {decisive.length > 0 && (
                  <span className='ml-2 text-[0.75rem] text-muted-foreground'>
                    {decisive
                      .map(condition =>
                        translateOr(
                          t,
                          `provision.param.${condition.parameter}`,
                          condition.parameter,
                        ),
                      )
                      .join(', ')}
                  </span>
                )}
              </span>
              <MarkedLine
                mark={mark}
                label={t(
                  mark === 'yes'
                    ? 'provision.rule.holds'
                    : mark === 'no'
                      ? 'provision.rule.excluded'
                      : 'provision.rule.open',
                )}
              />
            </li>
          );
        })}
      </ol>
    </div>
  );
}
