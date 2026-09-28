/**
 * What the packet turned out to say — the three lines that name a case to a
 * person: who is applying, about which property, under which parcel number.
 *
 * The engine reads fields off documents and publishes each with the sheet it
 * came from and how well it was read (`FieldDto`). What it does **not**
 * publish is which of them names the case: there is no "applicant" on the wire,
 * only `applicant_name` on one document type and `owner_name` on another. So
 * this module names the candidates it looks for and picks one of them per line.
 *
 * It is written as candidates and not as one name for a reason: which document
 * types a package carries is the profile's, and two profiles spell the same
 * reading differently. A reading nothing answers to is **absent** — the screen
 * says the packet did not yield it, never an empty value, and never a guess off
 * a field that means something else.
 *
 * Confidence decides between two answers and is then shown, because the whole
 * point of the screen it feeds is that a value read badly is a value a person
 * has to look at. The threshold is the client's own: the engine already files a
 * `LowConfidence` finding against a reading it doubts, and this is the softer
 * question of which line to put a second glance beside.
 */
import type {
  FieldDto,
  PackageDetailDto,
} from '@cadastre/api-contracts/verification';

export type PacketLine = 'applicant' | 'address' | 'parcel';

/** In the order the mockup reads them, which is the order a clerk says them. */
export const PACKET_LINES: readonly PacketLine[] = [
  'applicant',
  'address',
  'parcel',
];

export const PACKET_LINE_KEY: Record<PacketLine, string> = {
  applicant: 'intake.read.applicant',
  address: 'intake.read.address',
  parcel: 'intake.read.parcel',
};

/**
 * What each line may be read off: a line is a list of **facts** it would
 * accept, and each fact is the list of field names that same fact is written
 * under. The two levels do not answer to the same rule, and that is the whole
 * point of there being two.
 *
 * **Within a fact, confidence decides** and the order settles a tie. Names in
 * one group are one thing read twice, so the surer reading of them is simply
 * the better reading and the worse one is not what to put in front of a person.
 * `applicant_name` and `owner_name` are that: the person applying and the
 * person of record are the same on most submissions, spelled off two different
 * sheets, so the same person at 99 % and at 60 % is one fact read twice. First
 * listed wins an exact tie, because the packet is the applicant's.
 *
 * **Between facts, the order decides and confidence does not.** A later group
 * answers only when every earlier one went unread. These are different things,
 * not different readings, and a surer reading of the wrong thing is still the
 * wrong thing: `certificate_no` read at 96 % does not become the parcel's
 * cadastral number because `cadastral_number` was only read at 89 %. The line
 * asks "the cadastral number; failing that, at least the certificate number",
 * and a confidence comparison across that boundary would answer a question
 * nobody asked. The same holds for `payer_name`, which is a fourth party often
 * enough — a relative or a representative pays — that reading it surely says
 * nothing about who is applying.
 *
 * So: do not flatten these groups back into one list. Two names belong in one
 * group only when a person would call them the same fact.
 */
const CANDIDATES: Record<PacketLine, readonly (readonly string[])[]> = {
  applicant: [['applicant_name', 'owner_name'], ['payer_name']],
  // One name, so nothing to choose between: the single group is the shape,
  // not a claim that no second spelling of the address could ever join it.
  address: [['property_address']],
  parcel: [['cadastral_number'], ['certificate_no'], ['inventory_no']],
};

/**
 * Below this, a reading is shown with the doubt beside it and an invitation to
 * check the sheet. Ours and not the engine's, and deliberately generous: this
 * decides where a second glance is suggested, not what is held against the
 * package.
 */
export const READ_WELL_ENOUGH = 0.9;

export type PacketReading = {
  readonly line: PacketLine;
  /** Null when nothing in the packet answered to it. */
  readonly field: FieldDto | null;
  /** The document the value was read off, so the reader can open the sheet. */
  readonly documentId: string | null;
  /** The name the engine published it under — shown, so the reading can be
   *  traced back to the field it came from rather than trusted blindly. */
  readonly fieldName: string | null;
};

/**
 * Whether a value was read surely enough to be shown as what the paper says.
 *
 * Takes the confidence and not the reading, because the same question is asked
 * of two different shapes of the same fact: the packet readings this module
 * assembles from a package's documents, and the `StatedValueDto` the register's
 * list endpoint already publishes per row. One threshold, asked in one place —
 * two copies is how a row and its case sheet come to disagree about which
 * reading is worth a second look.
 */
export function readWellEnough(confidence: number): boolean {
  return confidence >= READ_WELL_ENOUGH;
}

/** Whether this reading is one to look at rather than one to accept. */
export function needsAGlance(reading: PacketReading): boolean {
  return reading.field !== null && !readWellEnough(reading.field.confidence);
}

/**
 * The three lines, read off the package as it now stands.
 *
 * Always three, in order, present or not: a line that vanished when the packet
 * did not yield it would leave the reader unable to tell "we did not read this"
 * from "we did not look".
 */
export function readPacket(detail: PackageDetailDto): readonly PacketReading[] {
  const found = new Map<string, { field: FieldDto; documentId: string }>();
  for (const file of detail.files) {
    for (const document of file.documents) {
      for (const field of document.fields) {
        const best = found.get(field.name);
        // The surest reading of a field wins. A packet may hold the same value
        // on three sheets, and the one read worst is not the one to show.
        if (best === undefined || field.confidence > best.field.confidence) {
          found.set(field.name, { field, documentId: document.id });
        }
      }
    }
  }

  return PACKET_LINES.map(line => {
    let picked: { field: FieldDto; documentId: string; name: string } | null =
      null;
    // Facts in order: the first one the packet yielded answers the line, and a
    // later fact never outbids an earlier one however surely it was read.
    for (const fact of CANDIDATES[line]) {
      for (const name of fact) {
        const hit = found.get(name);
        if (hit === undefined) continue;
        // Within the fact, the surest reading wins whichever name carried it.
        // Strictly greater, so an equally sure reading leaves the name listed
        // first in place and the order of the group settles the tie.
        if (picked === null || hit.field.confidence > picked.field.confidence) {
          picked = { field: hit.field, documentId: hit.documentId, name };
        }
      }
      if (picked !== null) break;
    }
    return picked === null
      ? { line, field: null, documentId: null, fieldName: null }
      : {
          line,
          field: picked.field,
          documentId: picked.documentId,
          fieldName: picked.name,
        };
  });
}
