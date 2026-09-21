/**
 * The register of documents inside one case, as questions about a paper rather
 * than as markup: which segment it falls in, whether it holds anything the
 * inspector should look at, and how much weight it is drawn with.
 *
 * Every answer is read off what the server published — the document's type, its
 * own readings, whether a later arrival pushed it out of force — and off the
 * profile's own list of required papers. Nothing here decides that a paper is
 * missing or that a reading is wrong; it only says how loudly each one should
 * be printed.
 */
import { fieldsReadHere, isSuperseded } from '@/entities/verification-package';
import {
  CONFIDENCE_FLOOR,
  type DocumentDto,
  type PackageDetailDto,
} from '@cadastre/api-contracts/verification';

/** Every document the engine found, across all uploaded files, in reading
 *  order. */
export function documentsOf(pkg: PackageDetailDto): DocumentDto[] {
  return pkg.files.flatMap(file => file.documents);
}

// ─── What the register is filtered by ────────────────────────────────────────
// A package this size is mostly settled work: of sixteen documents the engine
// read here, six carry a reading the inspector should look at and eight are not
// documents this profile asks for at all. Rendering all of them at equal weight
// is what buries the six. The segments are the register's own triage — the same
// control the package register uses, with the same counts.
export type DocSegment = 'review' | 'all' | 'other';

export const SEGMENTS: DocSegment[] = ['review', 'all', 'other'];

export const SEGMENT_KEY: Record<DocSegment, string> = {
  review: 'detail.seg.review',
  all: 'detail.seg.all',
  other: 'detail.seg.other',
};

/** A paper the catalogue could not name: read, placed, and not one of the
 *  grounds the law lists. It is evidence of what was in the envelope, never a
 *  shortfall. */
export function isAside(doc: DocumentDto): boolean {
  return doc.type === 'out_of_profile';
}

/** Whether this document holds anything the inspector should actually look at:
 *  a reading below the floor, or a type the classifier could not place. Its
 *  answer decides both the segment a document falls in and whether the entry
 *  opens with its fields showing.
 *
 *  Only what was read off this paper counts. A value carried in from another
 *  document of the package may well sit under the floor — it is the source's
 *  reading, discounted — but the doubt is about the sheet it was read on, and
 *  it is already reported there (ADR-0023). Counting it here would send the
 *  inspector to a paper with nothing on it to look at. */
export function needsReview(doc: DocumentDto): boolean {
  // A scan a later arrival has pushed out of force is the record of what was
  // sent first, not a paper the case rests on: the report, the checks and the
  // register's questions are all worked out from the documents in force
  // (COMM-80). Counting its faults here would send the inspector to settle a
  // reading nothing is decided on, and would count the work twice — once on the
  // spent scan and once on the one that replaced it.
  if (isSuperseded(doc)) return false;
  if (doc.type === null || doc.type === 'unknown') return true;
  if (isAside(doc)) return false;
  if (
    doc.classificationConfidence != null &&
    doc.classificationConfidence < CONFIDENCE_FLOOR
  )
    return true;
  return fieldsReadHere(doc.fields).some(f => f.confidence < CONFIDENCE_FLOOR);
}

export function inSegment(doc: DocumentDto, segment: DocSegment): boolean {
  if (segment === 'all') return true;
  if (segment === 'other') return isAside(doc);
  return needsReview(doc);
}

/** Rendered *and* spelled out. Under "all" the service sheets are in the
 *  register but folded into the line that stands for them, so a jump aimed at
 *  one has to land somewhere else — being on the page is not the same as being
 *  reachable. */
export function isOpenIn(doc: DocumentDto, segment: DocSegment): boolean {
  if (!inSegment(doc, segment)) return false;
  return !(segment === 'all' && isAside(doc));
}

// ─── How loudly a paper is printed ───────────────────────────────────────────

/**
 * The three weights a document is drawn at.
 *
 * A case is read top to bottom once and scanned many times after that, and
 * sixteen entries set in one size say the register has no opinion about which
 * of them the inspector is here for. It has one, and the profile and the
 * report between them already state it: a paper the profile insists on, or one
 * carrying a reading somebody has to check, is what the case turns on; a paper
 * nobody asked for, or one a later scan has pushed out of force, is the record
 * of what was in the envelope.
 *
 * Drawn in type, space and rule — kegel and weight on the heading, the room
 * around the entry, and how heavy the line above it is — rather than in a
 * badge, a card or a colour: this is a ruled page, and the way a ruled page
 * says "read this first" is by printing it larger with more air around it
 * (COMM-110, and the register's own Flat-Page and Earned-Lift rules).
 */
export type DocumentWeight = 'primary' | 'standard' | 'quiet';

/**
 * The weight one document is drawn at, given the papers its profile requires.
 *
 * `required` is the profile's own list (`requiredTypes`) and never a list kept
 * here: which papers a package must carry is policy the engine publishes
 * (ADR-0002), and a second copy of it on this screen would be the register
 * disagreeing with the engine about what matters.
 *
 * Quiet is tested before primary on purpose. A spent scan may well be of a
 * required type and may well carry a doubtful reading; it is still the paper
 * the case no longer rests on, and drawing it loudest would send the inspector
 * to settle a reading nothing is decided on (COMM-80).
 */
export function documentWeight(
  doc: DocumentDto,
  required: readonly string[],
): DocumentWeight {
  if (isSuperseded(doc) || isAside(doc)) return 'quiet';
  if (needsReview(doc)) return 'primary';
  return doc.type !== null && required.includes(doc.type)
    ? 'primary'
    : 'standard';
}
