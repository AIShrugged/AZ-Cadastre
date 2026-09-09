/**
 * What the office declares at the counter, as the intake screen holds it.
 *
 * Two figures and a source of their own: the ground the claimed right rests on
 * and the year the building is declared to have been built. Neither is a
 * reading — nothing was read yet when they are typed — and the contract keeps
 * them apart from what the pipeline finds for exactly that reason
 * (`DeclaredAtIntakeDto`). This module is the screen's side of that: it holds
 * the two boxes as the operator fills them, and turns them into what
 * `POST /packages` and `GET /profiles/suggestion` take.
 *
 * **Both are optional and stay optional.** A package taken in with neither is
 * the submission this system has always accepted, so an empty declaration is
 * left out of the request entirely rather than sent as nulls or as empty
 * strings — "not declared" is an absence, and a placeholder for it would be a
 * claim nobody made.
 *
 * The year is kept as the text in the box rather than as a number, because a
 * half-typed year is neither a number nor an error: `19` on the way to `1998`
 * is a box being filled, and a form that refused it as it was typed would be
 * arguing with the operator mid-keystroke. `readDeclaredYear` is what says
 * which of the three states the box is in, and the window it is read against is
 * the contract's own.
 */
import {
  DECLARED_YEAR_EARLIEST,
  DECLARED_YEAR_LATEST,
  type DeclaredAtIntakeInput,
  type ProfileDto,
  type SuggestProfileRequestInput,
} from '@cadastre/api-contracts/verification';

export { DECLARED_YEAR_EARLIEST, DECLARED_YEAR_LATEST };

// Every year in the contract's window is four digits, which is what makes a
// shorter run of them a box being filled rather than a figure out of range.
export const DIGITS_IN_A_YEAR = 4;

/** The two boxes, as they stand. `null` ground is nothing chosen. */
export type DeclaredDraft = {
  legalBasis: string | null;
  builtYear: string;
};

export const BLANK_DECLARATION: DeclaredDraft = {
  legalBasis: null,
  builtYear: '',
};

/**
 * What a declaration says once it is readable — the shape both the suggestion
 * and the submission are built from, and the shape the reasons are explained
 * against.
 */
export type Declaration = {
  legalBasis: string | null;
  builtYear: number | null;
};

export const NOTHING_DECLARED: Declaration = {
  legalBasis: null,
  builtYear: null,
};

/**
 * An empty box, a year being typed, a year, or something that is not one.
 *
 * `typing` is the state that keeps the form from arguing mid-keystroke: every
 * year the engine reads is four digits, so one, two or three of them is a box
 * being filled and not a figure to refuse. It declares nothing yet — the
 * suggestion is asked about the ground alone until the fourth digit lands.
 */
export type YearReading =
  | { state: 'blank' }
  | { state: 'typing' }
  | { state: 'year'; year: number }
  | { state: 'unreadable' };

/**
 * The year box, read.
 *
 * Unreadable covers both halves of the same refusal: a figure that is not a
 * whole number, and one outside the window the engine reads a year in. The
 * bounds are the contract's (`DECLARED_YEAR_EARLIEST`…`DECLARED_YEAR_LATEST`)
 * and never a pair chosen here — the edge refuses what falls outside them, and
 * a screen with its own window would either send a 400 or withhold a year the
 * engine would have taken.
 */
export function readDeclaredYear(text: string): YearReading {
  const trimmed = text.trim();
  if (trimmed === '') return { state: 'blank' };

  if (!/^\d+$/.test(trimmed)) return { state: 'unreadable' };
  if (trimmed.length < DIGITS_IN_A_YEAR) return { state: 'typing' };

  const year = Number(trimmed);
  if (year < DECLARED_YEAR_EARLIEST || year > DECLARED_YEAR_LATEST) {
    return { state: 'unreadable' };
  }

  return { state: 'year', year };
}

/** The draft as a declaration, with an unreadable year counting as no year. */
export function readDeclaration(draft: DeclaredDraft): Declaration {
  const year = readDeclaredYear(draft.builtYear);
  return {
    legalBasis: draft.legalBasis,
    builtYear: year.state === 'year' ? year.year : null,
  };
}

/** Whether anything has been declared at all. */
export function declaresAnything(declared: Declaration): boolean {
  return declared.legalBasis !== null || declared.builtYear !== null;
}

/**
 * The grounds the operator may declare.
 *
 * A profile's own `grounds` once one is chosen — the ground has to be one the
 * profile registers a right on, and `POST /packages` refuses a basis that is
 * not (`LEGAL_BASIS_NOT_IN_PROFILE`). Before a profile is chosen it is every
 * ground the catalogue names, in profile order and without repeats: the
 * declaration is what the suggestion is made from, so a screen that offered
 * nothing until a profile was picked would make the suggestion useless at the
 * only moment it helps.
 */
export function groundsOffered(
  profiles: readonly ProfileDto[],
  profileKey: string | null,
): readonly string[] {
  const named =
    profileKey === null
      ? profiles
      : profiles.filter(profile => profile.key === profileKey);

  return [...new Set(named.flatMap(profile => profile.grounds))];
}

/**
 * The profiles that register a right founded on this ground — the same reading
 * the engine's `IntakeSpec.registers` makes, off the `grounds` the contract
 * publishes for it.
 */
export function registering(
  profiles: readonly ProfileDto[],
  basis: string | null,
): readonly ProfileDto[] {
  if (basis === null) return [];
  return profiles.filter(profile => profile.grounds.includes(basis));
}

/**
 * Whether the chosen profile registers what has been declared.
 *
 * False only where both are chosen and they disagree — which the service
 * refuses with `LEGAL_BASIS_NOT_IN_PROFILE`, and which the screen would rather
 * say before the packet is sent than after it comes back.
 */
export function groundFitsProfile(
  profiles: readonly ProfileDto[],
  profileKey: string | null,
  basis: string | null,
): boolean {
  if (profileKey === null || basis === null) return true;

  const profile = profiles.find(candidate => candidate.key === profileKey);
  // A profile this build has never heard of is nothing to hold a ground
  // against: the service is the one that knows, and it will say so.
  if (!profile) return true;

  return profile.grounds.includes(basis);
}

/**
 * The declaration as `POST /packages` takes it, or `undefined` where nothing
 * was declared.
 *
 * Only what was actually declared travels: a figure left out is left out of the
 * body, never sent as `null` and never as `''`. Undefined for an empty
 * declaration, so a package taken in without one is byte for byte the request
 * this endpoint took before intake asked anything.
 */
export function toDeclaredInput(
  declared: Declaration,
): DeclaredAtIntakeInput | undefined {
  if (!declaresAnything(declared)) return undefined;

  return {
    ...(declared.legalBasis !== null && { legalBasis: declared.legalBasis }),
    ...(declared.builtYear !== null && { builtYear: declared.builtYear }),
  };
}

/**
 * The declaration as `GET /profiles/suggestion` takes it, or `null` where
 * nothing has been declared to ask about.
 *
 * The endpoint answers a question with neither figure perfectly well — with no
 * profile and the reason why — but an untouched form has not asked anything
 * yet, and a screen that reported "no profile" before the operator had typed a
 * character would read as a refusal rather than as a blank form. What is left
 * out of the question is what was not declared: an empty string is not a
 * ground, and the contract reads one as nothing declared anyway.
 */
export function toSuggestionRequest(
  declared: Declaration,
): SuggestProfileRequestInput | null {
  if (!declaresAnything(declared)) return null;

  return {
    ...(declared.legalBasis !== null && { legalBasis: declared.legalBasis }),
    ...(declared.builtYear !== null && { builtYear: declared.builtYear }),
  };
}
