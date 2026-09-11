import { Confidence } from '../value-objects/confidence.vo.js';
import { DocumentType } from '../value-objects/document-type.vo.js';
import type { VerificationProfile } from '../value-objects/verification-profile.vo.js';

/**
 * Why a package will take a document it already has files for.
 *
 * Three reasons and not one flag, because an operator answers them differently:
 * one is a paper nobody sent, one is a paper that arrived and could not be read
 * well enough, and one is a paper this policy takes whenever it turns up. A
 * screen that could only say "you may upload something here" would be a screen
 * that cannot say what to upload.
 */
export const GAP_REASONS = [
  // A type the profile requires that no document in force answers.
  'MissingDocument',
  // A document that is here and was read badly: the profile asks for a field
  // its sheets did not yield, or something read off it — the placement itself
  // included — came back under `Confidence.FLOOR`. This is the one reason that
  // names a document, because filling it replaces that document.
  'UnusableScan',
  // A paper the profile takes at any time, whether or not the package is short
  // of one — the receipt for the state duty is the case it exists for. Never a
  // shortfall: it is published on a package with nothing wrong with it.
  'AlwaysAccepted',
] as const;
export type GapReason = (typeof GAP_REASONS)[number];

/**
 * One thing this package will take a document for.
 *
 * Worked out by the engine and published as it stands, never re-derived by a
 * caller: a client that decided for itself which uploads to offer would offer
 * one the server refuses, and hide one it would have taken (COMM-80).
 */
export type DocumentGap = {
  readonly reason: GapReason;
  // The profile document type a file sent in for this gap has to turn out to
  // be. Always set — a gap nobody could name a paper for is not an offer.
  readonly expectedType: DocumentType;
  // The document that would be replaced, set on `UnusableScan` and null on the
  // other two: there is nothing in the package to replace.
  readonly documentId: string | null;
  // The file that document was carved out of, so a screen can open the scan the
  // operator is being asked to better. Null wherever `documentId` is.
  readonly sourceFileId: string | null;
};

/**
 * A document of the package as this rule needs to see it: what it was placed
 * as, how sure that placement was, what was read **off it** and how well, and
 * whether a later arrival has pushed it out of force.
 *
 * Flat data and not the entity, because the same rule answers for the read side
 * — which holds rows and never loads the aggregate — and one rule with two
 * implementations is two rules (the same reason `attestationOf` is shaped this
 * way).
 */
export type ReadDocument = {
  readonly documentId: string;
  readonly sourceFileId: string;
  // Null until the document is classified; `out_of_profile` and `unknown` are
  // classifications and arrive here as they are.
  readonly type: string | null;
  readonly classifiedAt: number | null;
  // Only what was read off this document. A value carried over from another
  // paper says the package is consistent and says nothing about this scan, so
  // it neither answers a field nor doubts one here (ADR-0023).
  readonly readings: readonly {
    readonly key: string;
    readonly confidence: number;
  }[];
  readonly superseded: boolean;
};

/**
 * What this package will take a document for, and why.
 *
 * The server's answer and the server's alone. The same list decides what the
 * detail response publishes and what the supply operation accepts, so a screen
 * drawing buttons off it cannot offer an upload that would be refused — which
 * is the whole reason the rule is here and not in two places (COMM-80).
 *
 * Ordered: the papers that are not here, then the ones that are here and were
 * read badly, then what the profile takes at any time. A required type that is
 * genuinely absent is published as `MissingDocument` and never twice — the
 * always-accepted pass adds its own entry only where the missing pass did not
 * already make one, so the three reasons stay distinguishable instead of one
 * type appearing under two of them.
 */
export function gapsIn(
  profile: VerificationProfile,
  documents: readonly ReadDocument[],
): readonly DocumentGap[] {
  const inForce = documents.filter(document => !document.superseded);
  const placed = inForce.flatMap(document => {
    const type =
      document.type === null ? null : DocumentType.create(document.type);

    return type?.isKnown ? [{ document, type }] : [];
  });

  const missing = profile.requiredTypes
    .filter(required => !placed.some(({ type }) => type.equals(required)))
    .map(expectedType => gap('MissingDocument', expectedType));

  const unusable = placed
    .filter(({ document, type }) => wasReadBadly(profile, document, type))
    .map(({ document, type }) =>
      gap('UnusableScan', type, document.documentId, document.sourceFileId),
    );

  const anyTime = profile.specs
    .filter(spec => spec.isAlwaysAccepted)
    .filter(
      spec => !missing.some(already => already.expectedType.equals(spec.type)),
    )
    .map(spec => gap('AlwaysAccepted', spec.type));

  return [...missing, ...unusable, ...anyTime];
}

/**
 * Whether this document is a scan worth sending again.
 *
 * Two halves of one question, and either is enough: a field the profile asks of
 * this type that its own sheets did not yield, or anything read off it that the
 * engine is not sure of — the placement included, because a paper the classifier
 * half-recognised is a paper an inspector cannot rely on being the right one.
 *
 * A type the profile declares no fields for can still be offered on the
 * placement alone; it simply has no fields to be short of.
 */
function wasReadBadly(
  profile: VerificationProfile,
  document: ReadDocument,
  type: DocumentType,
): boolean {
  if (
    document.classifiedAt !== null &&
    Confidence.of(document.classifiedAt).isBelow(Confidence.FLOOR)
  ) {
    return true;
  }

  const read = new Set(document.readings.map(reading => reading.key));
  const unread = profile
    .schemaFor(type)
    .specs.some(spec => !read.has(spec.key.value));

  return (
    unread ||
    document.readings.some(reading =>
      Confidence.of(reading.confidence).isBelow(Confidence.FLOOR),
    )
  );
}

function gap(
  reason: GapReason,
  expectedType: DocumentType,
  documentId: string | null = null,
  sourceFileId: string | null = null,
): DocumentGap {
  return { reason, expectedType, documentId, sourceFileId };
}
