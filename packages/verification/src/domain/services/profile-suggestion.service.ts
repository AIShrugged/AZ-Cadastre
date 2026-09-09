/*
 * Which profile the figures declared at intake point at, and why.
 *
 * A rule that belongs to no aggregate: nothing has been submitted yet, and the
 * question is asked of the whole catalogue of profiles rather than of any one
 * of them. It reads what each profile says it takes in and reports what that
 * settles — it never decides. The operator picks the profile, and a package is
 * filed under their choice whatever this answered.
 *
 * Every answer carries its reasoning, and the reasoning is stated criterion by
 * criterion even when the criterion settled nothing. An operator who is shown
 * "cadastre" and nothing else can only accept it or distrust it; one who is
 * told which ground selected it, and that the year they typed ruled nothing
 * out, can disagree with the part that is wrong.
 */

import type { DeclaredAtIntake } from '../value-objects/declared-at-intake.vo.js';
import type { DocumentType } from '../value-objects/document-type.vo.js';
import type { IntakeSpec } from '../value-objects/verification-profile.vo.js';

/*
 * A profile as this rule needs to see it: its key, and what it says it takes
 * in. Not the whole `VerificationProfile` — which every profile satisfies
 * anyway — because nothing about a document type, a cross-check or a register
 * question takes part in the answer, and a rule that asked for them would
 * suggest it weighed them.
 */
export type ProfileIntake = {
  readonly key: string;
  readonly intake: IntakeSpec;
};

// One of the two figures the office declares, and the only two things a
// suggestion is ever decided on.
export type SuggestionCriterion = 'legalBasis' | 'builtYear';

// The audit line for one criterion, written in English when the suggestion was
// made. A reader is shown it beside the field it is about, which is what
// `criterion` is for.
export type SuggestionReason = {
  readonly criterion: SuggestionCriterion;
  readonly note: string;
};

export type ProfileSuggestion = {
  // Null where the declaration points at no profile, and null where it points
  // at more than one: choosing between two profiles the declaration does not
  // choose between would be deciding rather than suggesting. Which of the two
  // it was is in the reasons, and they are stated either way.
  readonly profileKey: string | null;
  // Both criteria, in the order they were read, whatever each of them settled.
  readonly reasons: readonly SuggestionReason[];
};

export function suggestProfile(
  declared: DeclaredAtIntake,
  profiles: readonly ProfileIntake[],
): ProfileSuggestion {
  const basis = declared.legalBasis;
  const year = declared.builtYear;

  // The ground selects, the year narrows. In that order and never the other way
  // round: a year is a fact about a building and a ground is what a case is,
  // and no shipped profile is bounded by a period at all.
  const registering =
    basis === null
      ? []
      : profiles.filter(profile => profile.intake.registers(basis));
  const answering = registering.filter(profile =>
    profile.intake.takesCaseFrom(year),
  );

  return {
    // One candidate and no other. Not "the first of them" and not "the only
    // profile there happens to be": an office that ships one profile today and
    // two tomorrow must not find that the suggestion silently changed meaning.
    profileKey: answering.length === 1 ? (answering[0]?.key ?? null) : null,
    reasons: [
      {
        criterion: 'legalBasis',
        note: groundNote(basis, registering, profiles),
      },
      { criterion: 'builtYear', note: yearNote(year, registering, answering) },
    ],
  };
}

function groundNote(
  basis: DocumentType | null,
  registering: readonly ProfileIntake[],
  profiles: readonly ProfileIntake[],
): string {
  if (basis === null) {
    return (
      'No ground was declared. Which paper a right is founded on is what tells ' +
      'one profile from another, so none is proposed until one is.'
    );
  }

  if (registering.length === 0) {
    return (
      `No profile registers a right founded on "${basis.value}". ` +
      `What is registered: ${catalogueOf(profiles)}.`
    );
  }

  if (registering.length > 1) {
    return (
      `More than one profile registers a right founded on "${basis.value}" — ` +
      `${keysOf(registering)}. Which of them this case belongs to is not ` +
      `something the declaration says.`
    );
  }

  return (
    `"${basis.value}" is a ground ${keysOf(registering)} registers a right ` +
    `on, and the only profile that does.`
  );
}

function yearNote(
  year: number | null,
  registering: readonly ProfileIntake[],
  answering: readonly ProfileIntake[],
): string {
  if (registering.length === 0) {
    return year === null
      ? 'No year was declared, and with no profile selected there was nothing for it to narrow.'
      : `The year ${year} was declared. With no profile selected there was nothing for it to narrow.`;
  }

  const bounded = registering.filter(profile => profile.intake.isBoundedByYear);

  if (bounded.length === 0) {
    return year === null
      ? 'No year was declared, and none was needed: no profile that registers this ground answers for a period rather than for any year.'
      : `The year ${year} ruled nothing out: no profile that registers this ground answers for a period rather than for any year.`;
  }

  if (year === null) {
    return (
      `No year was declared, so ${keysOf(bounded)} — which answers only for ` +
      `${boundsOf(bounded)} — could be neither ruled in nor out.`
    );
  }

  if (answering.length === 0) {
    return (
      `The year ${year} rules out every profile that registers this ground: ` +
      `${boundedAs(registering)}.`
    );
  }

  return `The year ${year} leaves ${keysOf(answering)}.`;
}

// The grounds every profile in the catalogue registers, so an operator told
// theirs is not one of them can see what is. A profile that names none is left
// out: it is nothing an operator could have meant to pick.
function catalogueOf(profiles: readonly ProfileIntake[]): string {
  const named = profiles.filter(profile => profile.intake.grounds.length > 0);

  if (named.length === 0) return 'no profile in this build names a ground';

  return named
    .map(profile => `"${profile.key}" on ${profile.intake.cited}`)
    .join('; ');
}

function keysOf(profiles: readonly ProfileIntake[]): string {
  return profiles.map(profile => `"${profile.key}"`).join(', ');
}

function boundsOf(profiles: readonly ProfileIntake[]): string {
  return profiles.map(profile => profile.intake.years).join(', ');
}

function boundedAs(profiles: readonly ProfileIntake[]): string {
  return profiles
    .map(
      profile =>
        `"${profile.key}" answers for ${profile.intake.years || 'any year'}`,
    )
    .join('; ');
}
