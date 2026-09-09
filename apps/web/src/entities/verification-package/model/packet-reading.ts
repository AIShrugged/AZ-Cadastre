/**
 * What the packet turned out to say — the three lines that name a case to a
 * person: who is applying, about which property, under which parcel number.
 *
 * The engine reads fields off documents and publishes each with the sheet it
 * came from and how well it was read (`FieldDto`). What it does **not**
 * publish is which of them names the case: there is no "applicant" on the wire,
 * only `applicant_name` on one document type and `owner_name` on another. So
 * this module names the candidates it looks for, in the order it prefers them,
 * and that list is the one judgement here.
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
 * The field names each line may be read off, best first.
 *
 * `applicant_name` before `owner_name`: the person applying and the person of
 * record are the same on most submissions and not on all, and the packet is the
 * applicant's.
 */
const CANDIDATES: Record<PacketLine, readonly string[]> = {
  applicant: ['applicant_name', 'owner_name', 'payer_name'],
  address: ['property_address'],
  parcel: ['cadastral_number', 'certificate_no', 'inventory_no'],
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

/** Whether this reading is one to look at rather than one to accept. */
export function needsAGlance(reading: PacketReading): boolean {
  return reading.field !== null && reading.field.confidence < READ_WELL_ENOUGH;
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
    for (const name of CANDIDATES[line]) {
      const hit = found.get(name);
      if (hit !== undefined) {
        return {
          line,
          field: hit.field,
          documentId: hit.documentId,
          fieldName: name,
        };
      }
    }
    return { line, field: null, documentId: null, fieldName: null };
  });
}
