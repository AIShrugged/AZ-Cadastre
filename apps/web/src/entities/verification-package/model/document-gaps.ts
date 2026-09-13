/**
 * What a package will take a document for, read off the contract.
 *
 * The list is the server's and this module works none of it out: which papers
 * are short, which scans were read badly and which the profile takes at any time
 * is one rule, and it lives in the engine (COMM-80). A client that decided for
 * itself would offer an upload the service refuses and hide one it would have
 * taken — and the two implementations would drift the first time the threshold
 * moved. So everything here either reads a published field or names it to a
 * reader; nothing here decides whether a gap exists.
 *
 * The one thing it does compute is the *account* of an `UnusableScan` — which
 * field of that document went unread and which reading came back doubtful. That
 * is not the rule restated: the server has already said this scan is worth
 * sending again, and this reads the published fields and the published schema to
 * say why, because "bad scan" with nothing beside it makes an operator rescan at
 * random (COMM-81).
 */
import type {
  DocumentDto,
  DocumentGapDto,
  DocumentGapReason,
  ProfileDto,
  SourceFileDto,
} from '@cadastre/api-contracts/verification';
import { CONFIDENCE_FLOOR } from '@cadastre/api-contracts/verification';

import { fieldsReadHere } from './field-origin';

/** The heading each reason is read under, in the reader's own language. */
export const GAP_REASON_KEY: Record<DocumentGapReason, string> = {
  MissingDocument: 'gap.missing',
  UnusableScan: 'gap.unusable',
  AlwaysAccepted: 'gap.any_time',
};

/**
 * What the reason asks of the operator, which is the part that differs.
 *
 * Three sentences and not one, because the three asks are not the same move:
 * bring the paper nobody sent, photograph again the paper that cannot be read,
 * and attach the paper the profile takes whenever it turns up. A surface that
 * could only say "you may upload something here" would be a surface that cannot
 * say what to upload.
 */
export const GAP_REASON_NOTE: Record<DocumentGapReason, string> = {
  MissingDocument: 'gap.missing_note',
  UnusableScan: 'gap.unusable_note',
  AlwaysAccepted: 'gap.any_time_note',
};

/**
 * How loudly a reason is drawn. Two of them are shortfalls and one is not: the
 * receipt for the state duty is published on a package with nothing wrong with
 * it, and drawing it in the same red as a missing title deed would invent a
 * finding the report never made.
 */
export type GapTone = 'short' | 'doubt' | 'offer';

export const GAP_REASON_TONE: Record<DocumentGapReason, GapTone> = {
  MissingDocument: 'short',
  UnusableScan: 'doubt',
  AlwaysAccepted: 'offer',
};

/**
 * A gap's identity on the screen, and the key an in-flight upload is tracked
 * under.
 *
 * Reason and type are not enough on their own: a profile that asks for two of a
 * kind can publish two `UnusableScan` gaps of the same type, one per document,
 * and a key that collapsed them would put the progress of one upload against
 * both rows.
 */
export function gapKey(gap: DocumentGapDto): string {
  return `${gap.reason}:${gap.expectedType}:${gap.documentId ?? ''}`;
}

/** What the supply operation is told this file answers — copied off the gap,
 *  never assembled from anything else. */
export function supplyTarget(gap: DocumentGapDto): {
  expectedType: string;
  replacesDocumentId: string | null;
} {
  return {
    expectedType: gap.expectedType,
    replacesDocumentId: gap.documentId,
  };
}

/**
 * The required papers the package is short of, as the server counted them.
 *
 * This is what the rail states, and it replaces a tally the client used to work
 * out from the profile against every document it could see. That tally was the
 * gap rule written a second time, and since COMM-80 it was also wrong: a scan
 * that has been replaced keeps its type, so a package whose replacement failed
 * to classify read as complete.
 */
export function missingTypes(
  gaps: readonly DocumentGapDto[],
): readonly string[] {
  return gaps
    .filter(gap => gap.reason === 'MissingDocument')
    .map(gap => gap.expectedType);
}

/** Whether a later arrival has pushed this document out of force. It stays in
 *  the package either way — a submission is evidence, not a working draft
 *  (COMM-80) — so this decides how it is drawn, never whether it is. */
export function isSuperseded(doc: DocumentDto): boolean {
  return doc.supersededAt !== null;
}

/**
 * The document a given id names, with the file it was carved out of.
 *
 * Both halves, because neither is worth much alone: an entry says which sheets
 * of which file a paper sits on, and a jump to the document that replaced a
 * spent one needs the file to name it by.
 */
export function documentIn(
  files: readonly SourceFileDto[],
  documentId: string | null,
): { document: DocumentDto; file: SourceFileDto } | null {
  if (documentId === null) return null;

  for (const file of files) {
    const document = file.documents.find(
      candidate => candidate.id === documentId,
    );
    if (document) return { document, file };
  }

  return null;
}

/** What the profile asks the engine to read off a document of this type, in
 *  profile order. Empty for a type this build's copy of the policy does not
 *  name — the server may know a type the screen has not been taught. */
export function fieldsAsked(
  profiles: readonly ProfileDto[],
  profileKey: string,
  documentType: string,
): readonly string[] {
  const profile = profiles.find(candidate => candidate.key === profileKey);
  const spec = profile?.documentTypes.find(type => type.key === documentType);
  return spec?.fields ?? [];
}

/**
 * Why this scan is worth sending again, in the operator's terms.
 *
 * Three separate answers because they are three different faults on the sheet:
 * a value the profile asks for that the paper never yielded, a value that was
 * read but not confidently, and a placement the classifier itself was unsure of.
 * An operator who is told only "bad scan" rephotographs at random; one who is
 * told the cadastral number went unread knows which corner of the page to get
 * right.
 *
 * Only what was read off this paper counts, the same rule the engine used to
 * publish the gap: a value carried over from another document of the package is
 * the source's reading discounted, and it says nothing about this scan
 * (ADR-0023).
 */
export type ScanShortfall = {
  /** Fields the profile asks of this type that this document's sheets did not
   *  yield. */
  readonly unread: readonly string[];
  /** What was read here and came back under the floor, with its score. */
  readonly doubted: readonly {
    readonly key: string;
    readonly confidence: number;
  }[];
  /** The placement score, where the classifier was not sure this paper is the
   *  type it was filed as. Null where it was. */
  readonly placement: number | null;
};

export function scanShortfall(
  doc: DocumentDto,
  asked: readonly string[],
): ScanShortfall {
  const read = fieldsReadHere(doc.fields);
  const names = new Set(read.map(field => field.name));

  return {
    unread: asked.filter(key => !names.has(key)),
    doubted: read
      .filter(field => field.confidence < CONFIDENCE_FLOOR)
      .map(field => ({ key: field.name, confidence: field.confidence })),
    placement:
      doc.classificationConfidence !== null &&
      doc.classificationConfidence < CONFIDENCE_FLOOR
        ? doc.classificationConfidence
        : null,
  };
}

/** Whether the account above has anything to show. False where the screen's copy
 *  of the profile is behind the engine's, and then the row says the scan is
 *  worth sending again without pretending to know why. */
export function namesAFault(shortfall: ScanShortfall): boolean {
  return (
    shortfall.unread.length > 0 ||
    shortfall.doubted.length > 0 ||
    shortfall.placement !== null
  );
}

/**
 * The papers the profile requires that the package is short of, in the
 * profile's own order.
 *
 * Not `missingTypes` itself. That is every `MissingDocument` gap, and a
 * requirement any of several papers answers publishes a gap for each of them —
 * sixteen titles to the land on a house whose provision is still open. The case
 * sheet lists the required papers and counts the ones found, so subtracting the
 * whole list from the required ones drew "-16 of 2".
 */
export function requiredShortfall(
  required: readonly string[],
  gaps: readonly DocumentGapDto[],
): readonly string[] {
  const missing = new Set(missingTypes(gaps));
  return required.filter(type => missing.has(type));
}
