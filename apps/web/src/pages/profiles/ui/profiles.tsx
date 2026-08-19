/**
 * Verification profiles — the policy surface. A profile is what a package is
 * measured against: which documents a submission of that kind must carry, and
 * what the engine reads off each of them. The register never keeps its own copy
 * of that policy (ADR-0002), so this page states it live from
 * `GET /api/profiles` — what the engine actually enforces, not what a screen
 * once said it did.
 *
 * Composed as an index beside a policy sheet rather than a stack of cards: the
 * system is built so that domains arrive as profiles rather than as code, so
 * the surface has to stay legible at ten of them, not just at the one that
 * ships. The index is the register's own row vocabulary — ruled, washed on
 * selection, marked on the leading edge — and each profile is addressable, so a
 * particular policy can be linked to and returned to.
 *
 * It reports policy; it does not edit it.
 */
import { FolderCogIcon } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';

import {
  ProfileGlyph,
  profileName,
  useGetProfilesQuery,
  type ProfileDto,
} from '@/entities/verification-package';
import { paths } from '@/shared/config';
import { translateOr, useI18n } from '@/shared/i18n';
import { cn } from '@/shared/lib/cn';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/shared/ui/empty';
import { Skeleton } from '@/shared/ui/skeleton';
import { SurfaceBody, SurfaceHeading, SurfacePage } from '@/shared/ui/surface';

// ─── The index ────────────────────────────────────────────────────────────────
// Every profile the engine publishes, in its own order, as ruled register rows:
// the name the inspector knows it by over the count that says how much it asks
// for. The open one takes the selection wash and the indigo leading marker the
// register uses for an active row — the same mark, so it needs no learning.
function ProfileIndex({
  profiles,
  openKey,
}: {
  profiles: readonly ProfileDto[];
  openKey: string | null;
}) {
  const { t } = useI18n();

  return (
    <nav
      aria-label={t('page.profiles.title')}
      className='border-b border-rule pb-7 xl:col-start-1 xl:row-start-1 xl:border-b-0 xl:border-r xl:pr-8 xl:pb-0'
    >
      <div className='flex items-baseline justify-between gap-3'>
        {/* Named for what the column is rather than for the page it sits on:
            "Verification profiles" is already the heading three lines above. */}
        <h2 className='register-label'>{t('profiles.all')}</h2>
        <span
          data-mono
          className='shrink-0 text-[0.8125rem] tabular-nums text-muted-foreground'
        >
          {profiles.length}
        </span>
      </div>

      <ul className='mt-3 border-t border-rule'>
        {profiles.map(profile => {
          const open = profile.key === openKey;
          const required = profile.documentTypes.filter(
            type => type.required,
          ).length;
          return (
            <li key={profile.key}>
              <Link
                to={paths.profile(profile.key)}
                aria-current={open ? 'page' : undefined}
                className={cn(
                  // The active marker is a leading rule drawn inside the row,
                  // not a border on it: rows keep one shared hairline, and the
                  // mark cannot shift the text it belongs to.
                  'relative flex items-start gap-3 border-b border-rule py-3 pl-3 pr-2 transition-colors',
                  'before:absolute before:inset-y-2 before:left-0 before:w-[2px] before:rounded-full before:bg-transparent',
                  'focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                  open
                    ? 'bg-selection-tint before:bg-primary'
                    : 'hover:bg-accent/60',
                )}
              >
                <ProfileGlyph
                  profileKey={profile.key}
                  className={cn(
                    'size-4 shrink-0 translate-y-0.5',
                    open ? 'text-primary' : 'text-muted-foreground',
                  )}
                />
                <span className='min-w-0 flex-1'>
                  <span
                    className={cn(
                      'block text-[0.875rem] leading-snug text-foreground',
                      open && 'font-medium',
                    )}
                  >
                    {profileName(t, profile.key)}
                  </span>
                  {/* The count is data and takes the mono; the word it counts
                      is language and stays in the sans. And it counts the
                      required ones — the number that says what a package under
                      this profile is incomplete without. */}
                  <span className='mt-1 block text-[0.8125rem] text-muted-foreground'>
                    <span data-mono className='tabular-nums'>
                      {required}
                    </span>{' '}
                    {t('profiles.required_label')}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// ─── One band of the sheet ────────────────────────────────────────────────────
// A ruled register of document types, headed once: the section names what this
// group of documents is to the profile, and the column opposite names what the
// rows opposite carry. Two columns, because a type is a name and a set of
// readings — the name column is fixed so the names align down the page and the
// readings wrap in the space that is left.
function TypeBand({
  heading,
  types,
  columnLabel,
}: {
  heading: string;
  types: readonly ProfileDto['documentTypes'][number][];
  // Only the first band on a sheet names the columns: the second is the same
  // table under a second heading, and a column header repeated down one page is
  // noise, not orientation.
  columnLabel: boolean;
}) {
  const { t } = useI18n();

  return (
    <section className='mt-9 first:mt-0'>
      {/* Headed on the row grid, so the field column's label stands at the head
          of the field column instead of drifting to the far edge of the page. */}
      <div className='grid gap-x-8 border-b border-rule-strong pb-2 sm:grid-cols-[minmax(9rem,15rem)_minmax(0,1fr)]'>
        <h3 className='register-label'>
          {heading}
          <span
            data-mono
            className='ml-2 tabular-nums text-muted-foreground/80'
          >
            {types.length}
          </span>
        </h3>
        {columnLabel && (
          // Below sm the two columns stack, so the header names a column that
          // is no longer beside anything — it is dropped rather than left to
          // float over the wrong content.
          <span className='register-label hidden sm:block'>
            {t('profiles.fields')}
          </span>
        )}
      </div>

      <ul>
        {types.map(type => (
          <li
            key={type.key}
            className='grid gap-x-8 gap-y-1.5 border-b border-rule py-3.5 sm:grid-cols-[minmax(9rem,15rem)_minmax(0,1fr)]'
          >
            <div className='min-w-0'>
              <span className='block text-[0.875rem] leading-snug text-foreground'>
                {/* A type the engine has and the dictionary has not falls back
                    to its bare key, never to another type's name. */}
                {translateOr(t, `doctype.${type.key}`, type.key)}
              </span>
              <span
                data-mono
                className='mt-0.5 block text-[0.8125rem] text-muted-foreground/70'
              >
                {type.key}
              </span>
            </div>

            {/* What the engine is asked to read off this document. Separated
                rather than listed, so five short nouns stay one glance instead
                of five lines. */}
            <p className='min-w-0 max-w-[70ch] text-[0.875rem] leading-relaxed text-muted-foreground'>
              {type.fields.length === 0
                ? t('profiles.no_fields')
                : type.fields
                    .map(field => translateOr(t, `field.${field}`, field))
                    .join(' · ')}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ─── The sheet ────────────────────────────────────────────────────────────────
// One profile, stated in full: what it is called, what a package under it is
// incomplete without, and what else it knows how to read.
function ProfileSheet({ profile }: { profile: ProfileDto }) {
  const { t } = useI18n();
  const required = profile.documentTypes.filter(type => type.required);
  const optional = profile.documentTypes.filter(type => !type.required);

  return (
    <article className='min-w-0'>
      {/* No rule under the name: the first band opens with its own heavier one
          a few lines below, and two rules that close to each other read as a
          box drawn around nothing. */}
      <header>
        <h2 className='text-[1rem] font-[550] leading-snug tracking-[-0.01em] text-balance text-foreground'>
          {profileName(t, profile.key)}
        </h2>
        <span
          data-mono
          className='mt-1 block text-[0.8125rem] text-muted-foreground'
        >
          {profile.key}
        </span>
      </header>

      <div className='mt-8'>
        {required.length > 0 && (
          <TypeBand
            heading={t('profiles.required_docs')}
            types={required}
            columnLabel
          />
        )}
        {optional.length > 0 && (
          <TypeBand
            heading={t('profiles.also_recognised')}
            types={optional}
            columnLabel={required.length === 0}
          />
        )}
      </div>

      <p className='mt-7 max-w-[65ch] text-[0.8125rem] leading-relaxed text-muted-foreground'>
        {t('profiles.engine')}
      </p>
    </article>
  );
}

function ProfilesSkeleton() {
  return (
    <div className='mx-auto grid w-full max-w-[88rem] gap-x-10 gap-y-7 px-4 py-7 md:px-8 md:py-9 xl:grid-cols-[19rem_minmax(0,1fr)]'>
      <div className='flex flex-col gap-3 xl:col-start-1'>
        <Skeleton className='h-3 w-20' />
        <Skeleton className='h-12 w-full' />
        <Skeleton className='h-12 w-full' />
      </div>
      <div className='flex flex-col gap-4 xl:col-start-2'>
        <Skeleton className='h-5 w-80 max-w-full' />
        <Skeleton className='h-3 w-24' />
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className='h-9 w-full' />
        ))}
      </div>
    </div>
  );
}

// A page with no profile on it is not an empty list — it is a system that
// cannot check anything, so it says that rather than offering an action.
function NoProfiles({ failed }: { failed: boolean }) {
  const { t } = useI18n();
  return (
    <Empty className='register-hatch flex-1 rounded-none border-0 border-t border-rule-strong px-6 py-24'>
      <EmptyMedia
        variant='icon'
        className='mb-0 size-12 rounded-xl border border-rule-strong bg-card text-muted-foreground shadow-[var(--shadow-sm)]'
      >
        <FolderCogIcon className='size-5' />
      </EmptyMedia>
      <EmptyHeader className='gap-1.5'>
        <EmptyTitle className='text-[1rem] font-semibold tracking-tight text-foreground'>
          {t(failed ? 'profiles.error.title' : 'profiles.empty.title')}
        </EmptyTitle>
        <EmptyDescription className='text-[0.875rem] leading-relaxed text-muted-foreground'>
          {t(failed ? 'profiles.error.body' : 'profiles.empty.body')}
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export function Profiles() {
  const { t } = useI18n();
  const { profileKey } = useParams();
  // Policy changes with a deployment, not with a package: asked for once and
  // cached, never polled.
  const { data: profiles = [], isLoading, isError } = useGetProfilesQuery();

  // A bare /profiles opens the first one — the surface is never a page of
  // chrome around nothing. A key that names no profile is not quietly swapped
  // for another: the sheet says so, and the index shows nothing open.
  const named = profileKey
    ? (profiles.find(profile => profile.key === profileKey) ?? null)
    : (profiles[0] ?? null);

  return (
    <SurfacePage>
      <SurfaceHeading
        title={t('page.profiles.title')}
        subtitle={t('page.profiles.subtitle')}
      />
      <SurfaceBody>
        {isLoading ? (
          <ProfilesSkeleton />
        ) : isError || profiles.length === 0 ? (
          <NoProfiles failed={isError} />
        ) : (
          <div className='mx-auto grid w-full max-w-[88rem] gap-x-10 gap-y-7 px-4 py-7 md:px-8 md:py-9 xl:grid-cols-[19rem_minmax(0,1fr)]'>
            <ProfileIndex profiles={profiles} openKey={named?.key ?? null} />

            <div className='min-w-0 xl:col-start-2 xl:row-start-1'>
              {named ? (
                <ProfileSheet profile={named} />
              ) : (
                <p className='text-[0.875rem] leading-relaxed text-muted-foreground'>
                  {t('profiles.unknown', { key: profileKey ?? '' })}
                </p>
              )}
            </div>
          </div>
        )}
      </SurfaceBody>
    </SurfacePage>
  );
}
