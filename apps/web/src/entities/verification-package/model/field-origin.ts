/**
 * Which of a document's fields are that document's own reading.
 *
 * A field publishes where its value came from (ADR-0023, ADR-0033), and one of
 * the four origins means the value was never printed on this paper at all: it
 * was carried over from another document of the same package, because the
 * profile says the two print one value and this one did not yield it.
 *
 * That distinction is not decoration on this client — it decides what the
 * inspector is told there is work in. A carried-over value is the source's
 * reading, discounted, so it may well sit below the confidence floor; counting
 * it as doubt against the document it hangs on would send the inspector to a
 * paper with nothing on it to look at, and would count one uncertain reading
 * twice — once here and once on the paper it was actually made on. The engine
 * files no `LowConfidence` finding against such a value for exactly that
 * reason, and the tallies this screen works out for itself must say the same
 * thing the report does.
 *
 * The fourth origin is a person: an operator who read the sheet and typed what
 * it says (ADR-0033). It is a reading of this document like the machine's own,
 * so it counts here — but it is not a reading the machine scored, which is a
 * separate question and the one `isScored` answers.
 */
import type { FieldDto } from '@cadastre/api-contracts/verification';

/** Whether this value was read off another paper of the package rather than
 *  off the document it is shown under. */
export function isCarriedOver(field: FieldDto): boolean {
  return field.origin === 'TakenFromAnotherDocument';
}

/** Whether a person typed this value off the paper, rather than the engine
 *  reading it. Permanent: the register never overwrites the origin, so a
 *  corrected value says so for as long as the case is kept. */
export function isOperatorEntered(field: FieldDto): boolean {
  return field.origin === 'EnteredByOperator';
}

/**
 * Whether the confidence beside this value is a figure worth printing.
 *
 * A corrected value carries `confidence: 1` because the contract has to carry
 * something, not because anything scored it — a person read the sheet, and
 * "100%" beside their reading would be the scale answering a question it was
 * never asked. Every machine reading keeps its figure (COMM-110).
 */
export function isScored(field: FieldDto): boolean {
  return !isOperatorEntered(field);
}

/** The readings a document actually made — what a finding about this paper, and
 *  a count of work on it, may be drawn from. */
export function fieldsReadHere(
  fields: readonly FieldDto[],
): readonly FieldDto[] {
  return fields.filter(field => !isCarriedOver(field));
}
