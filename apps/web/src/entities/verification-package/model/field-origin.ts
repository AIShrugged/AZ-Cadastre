/**
 * Which of a document's fields are that document's own reading.
 *
 * A field publishes where its value came from (ADR-0023), and one of the three
 * origins means the value was never printed on this paper at all: it was
 * carried over from another document of the same package, because the profile
 * says the two print one value and this one did not yield it.
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
 */
import type { FieldDto } from '@cadastre/api-contracts/verification';

/** Whether this value was read off another paper of the package rather than
 *  off the document it is shown under. */
export function isCarriedOver(field: FieldDto): boolean {
  return field.origin === 'TakenFromAnotherDocument';
}

/** The readings a document actually made — what a finding about this paper, and
 *  a count of work on it, may be drawn from. */
export function fieldsReadHere(
  fields: readonly FieldDto[],
): readonly FieldDto[] {
  return fields.filter(field => !isCarriedOver(field));
}
