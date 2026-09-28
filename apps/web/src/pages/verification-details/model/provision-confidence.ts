/**
 * Which of the six figures the Article 8 provision was decided on were read
 * well enough to decide it.
 *
 * The panel draws the server's answer and nothing here re-decides it. What it
 * answers is narrower: the contract publishes a confidence beside every figure
 * it read off a paper (`CaseParameterDto.from.confidence`), and the panel used
 * to print a figure read at 0.50 exactly as it prints one read at 0.99. A
 * doubtful figure puts the case under the wrong provision, and therefore asks
 * the applicant for the wrong papers, with nothing on the page saying anything
 * is in doubt.
 *
 * The threshold is the engine's own `CONFIDENCE_FLOOR` and never a copy of it:
 * two numbers called "low confidence" in one product disagree the first time
 * one of them moves (COMM-80).
 *
 * **Confirming is correcting.** There is no second, panel-local "confirmed"
 * flag and nothing new is stored: a figure the operator restates through the
 * `correct-field` feature comes back with the field's origin set to
 * `EnteredByOperator` (ADR-0033), which is a person's reading of the sheet and
 * not a reading the machine scored — so the mark goes out by itself on the next
 * read of the package. That is why the origin is looked up on the document
 * rather than the confidence taken at face value.
 *
 * A figure nobody scored (`confidence: null`) is doubtful, not certain. It is
 * precisely a reading an inspector should check, and the sheet already treats
 * an unscored value that way (`detail.unscored_why`).
 */
import { isOperatorEntered } from '@/entities/verification-package';
import {
  CONFIDENCE_FLOOR,
  type CaseParameter,
  type CaseParameterDto,
  type CaseProvisionDto,
  type DocumentDto,
  type FieldDto,
} from '@cadastre/api-contracts/verification';

/** The line of a paper a figure was read off, where the package still carries
 *  it. Null for a figure declared at intake, for one decided by the kind of a
 *  title document rather than by a line of it, and for a document this read no
 *  longer holds. */
export function fieldBehind(
  parameter: CaseParameterDto,
  documents: readonly DocumentDto[],
): FieldDto | null {
  const from = parameter.from;
  if (from === null || from.fieldName === null) return null;

  const document = documents.find(
    candidate => candidate.id === from.documentId,
  );
  return document?.fields.find(field => field.name === from.fieldName) ?? null;
}

/**
 * Whether this figure was read too poorly to decide a case on unchallenged.
 *
 * A figure the office declared at intake carries no reading of a paper at all,
 * so there is nothing to doubt and it is never marked: the mark has to mean
 * something.
 *
 * A figure decided by the *kind* of a title document is marked all the same.
 * Nothing was read off a line of it, but the paper was placed under that kind
 * with a confidence of its own, and the case rests on that placement exactly as
 * it rests on a figure read off a sheet. It has no field line to settle it on,
 * so its mark opens the document instead — the same place the source link
 * beneath it already goes.
 */
export function isDoubtful(
  parameter: CaseParameterDto,
  documents: readonly DocumentDto[],
): boolean {
  const from = parameter.from;
  if (from === null) return false;

  const field = fieldBehind(parameter, documents);
  if (field && isOperatorEntered(field)) return false;

  return from.confidence === null || from.confidence < CONFIDENCE_FLOOR;
}

/** Every figure of the case that is below the floor, by name. */
export function doubtfulParameters(
  provision: CaseProvisionDto,
  documents: readonly DocumentDto[],
): ReadonlySet<CaseParameter> {
  return new Set(
    provision.parameters
      .filter(parameter => isDoubtful(parameter, documents))
      .map(parameter => parameter.parameter),
  );
}

/**
 * The rules the case is still read against: the one that applies, or every
 * candidate while it is open — and every rule where neither is named, which is
 * the same set the options table draws its columns from, so the head of the
 * panel and the table below it never speak about different provisions.
 */
function rulesInPlay(provision: CaseProvisionDto) {
  const named = new Set(
    provision.provision ? [provision.provision] : provision.candidates,
  );
  const inPlay = provision.rules.filter(rule => named.has(rule.provision));
  return inPlay.length > 0 ? inPlay : provision.rules;
}

/**
 * Whether the provision rests on a figure the operator has not confirmed.
 *
 * Only the figures those rules actually turn on count. A doubtful right to the
 * land on a case no row weighs it in is a reading worth marking beside its own
 * value and no reason at all to say the provision is unsettled — a warning that
 * fires on figures the decision does not use is one that stops being read.
 */
export function restsOnUnconfirmed(
  provision: CaseProvisionDto,
  documents: readonly DocumentDto[],
): boolean {
  const doubtful = doubtfulParameters(provision, documents);
  if (doubtful.size === 0) return false;

  return rulesInPlay(provision).some(rule =>
    rule.conditions.some(condition => doubtful.has(condition.parameter)),
  );
}
