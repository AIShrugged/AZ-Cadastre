/**
 * What the engine made of the declaration, in the reader's language.
 *
 * The answer carries its reasoning criterion by criterion
 * (`SuggestionReasonDto`) so a screen can put each line **beside the field it is
 * about** instead of printing one paragraph under both. The `note` on it is the
 * English audit line written when the suggestion was made — it goes in the
 * record and never on the screen, the same way this client reads no other
 * English message the services produce. What is read here is `criterion`: which
 * of the two figures the line is about.
 *
 * The line itself is then said in the operator's own words, from what the
 * profiles publish. `grounds` is the whole of what selects a profile
 * (`IntakeSpec.registers` is membership of that list and nothing else), so
 * which profiles a declared ground points at is something this side can state
 * exactly rather than approximate. What the year did is read off the answer
 * instead of re-derived: the periods a profile answers for are not published,
 * so the screen says what the suggestion settled and never invents a bound.
 *
 * Nothing here decides anything. The suggestion recommends, the operator
 * chooses, and a package is filed under their choice whatever this said.
 */
import { translateOr } from '@/shared/i18n';
import type {
  ProfileSuggestionDto,
  SuggestionCriterion,
} from '@cadastre/api-contracts/verification';

import { registering, type Declaration } from './declared-intake';
import { profileName, type ProfileDto } from './profile';

/** The `t` from `useI18n`. */
type Translate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

/** One reason, said in the reader's language and ready to print. */
export type SuggestionLine = {
  criterion: SuggestionCriterion;
  text: string;
};

/**
 * The suggestion's reasoning, one line per criterion, in the order the engine
 * stated them.
 *
 * `declared` is the declaration the answer was **asked with** and not whatever
 * is in the boxes now: a reason printed against a figure the operator has since
 * changed would explain a suggestion nobody is looking at.
 */
export function suggestionLines(
  t: Translate,
  suggestion: ProfileSuggestionDto,
  declared: Declaration,
  profiles: readonly ProfileDto[],
): readonly SuggestionLine[] {
  return suggestion.reasons.map(reason => ({
    criterion: reason.criterion,
    text:
      reason.criterion === 'legalBasis'
        ? groundLine(t, declared, profiles)
        : yearLine(t, suggestion, declared, profiles),
  }));
}

/**
 * What the declared ground settled: nothing declared, a ground no profile
 * registers a right on, one that several do, or one that exactly one does.
 */
function groundLine(
  t: Translate,
  declared: Declaration,
  profiles: readonly ProfileDto[],
): string {
  const basis = declared.legalBasis;
  if (basis === null) return t('suggest.basis.none');

  const registers = registering(profiles, basis);
  const ground = groundName(t, basis);

  if (registers.length === 0) {
    return t('suggest.basis.unregistered', { ground });
  }

  if (registers.length > 1) {
    return t('suggest.basis.several', {
      ground,
      profiles: registers
        .map(profile => profileName(t, profile.key))
        .join(', '),
    });
  }

  return t('suggest.basis.only', {
    ground,
    profile: profileName(t, registers[0]?.key ?? ''),
  });
}

/**
 * What the declared year settled, read off the answer rather than worked out.
 *
 * With no profile selected by the ground there was nothing for a year to
 * narrow, whether one was declared or not — which is what the engine says of it
 * too. Where the ground did select, the answer is what tells the two apart: a
 * suggestion made is a year that left one profile standing, and a suggestion
 * withheld with a single candidate is a year that ruled that candidate out — or
 * a year the candidate is waiting on.
 */
function yearLine(
  t: Translate,
  suggestion: ProfileSuggestionDto,
  declared: Declaration,
  profiles: readonly ProfileDto[],
): string {
  const year = declared.builtYear;
  const registers = registering(profiles, declared.legalBasis);

  if (registers.length === 0) return t('suggest.year.moot');

  if (suggestion.profileKey !== null) {
    const profile = profileName(t, suggestion.profileKey);
    return year === null
      ? t('suggest.year.any', { profile })
      : t('suggest.year.leaves', { year, profile });
  }

  const only = registers.length === 1 ? registers[0] : null;

  if (year === null) {
    // One candidate and no suggestion with no year declared means the candidate
    // answers for a period rather than for any year: the year is precisely what
    // it is waiting on.
    return only
      ? t('suggest.year.awaited', { profile: profileName(t, only.key) })
      : t('suggest.year.undeclared');
  }

  return only
    ? t('suggest.year.rules_out', {
        year,
        profile: profileName(t, only.key),
      })
    : t('suggest.year.no_narrower', { year });
}

/** A document type in the reader's language, or its bare key where the
 *  dictionary has no word for it — a ground the engine has gained and the UI
 *  has not been taught. The same name the report and the document register call
 *  that paper by, and never a second vocabulary for it. */
export function groundName(t: Translate, key: string): string {
  return translateOr(t, `doctype.${key}`, key);
}
