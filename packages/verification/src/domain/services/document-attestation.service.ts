// What one document's sheets say about the marks an office attests a paper
// with, held against what the profile expects of a paper of its type.
//
// One service and not a rule per caller, because two callers ask the same
// question of the same sheets: the report, which files a finding when a mark
// the profile expects is not there, and the detail screen, which shows an
// inspector what was seen either way. A second reading of the transcription
// anywhere else would be a second opinion, and the first document the two
// disagreed on would be a report arguing with itself.
//
// The observation is stated apart from the expectation on purpose: a seal on a
// paper nobody asked to be sealed is still a seal, and a paper the profile
// expects nothing of still has an answer about what is on it. `expected` says
// what was asked; `state` says what was seen; neither is derived from the
// other.

import { attestationIn } from './transcription-marks.service.js';

/**
 * What was seen of one mark on one document.
 *
 * Four answers and not a boolean, because "not seen" and "not there" are
 * different things to an inspector and only one of them is about the paper.
 */
export const MARK_STATES = [
  // Seen: a seal whose legend was made out, or a signature.
  'Present',
  // Seals were seen and not one of their legends could be read. Only ever a
  // seal's answer — a signature is no text at all, so there is nothing about it
  // to fail to read.
  'Illegible',
  // The sheets were read and carry no such mark.
  'Absent',
  // No sheet of the document was read, so nothing was looked at. Saying the
  // mark is absent here would be a claim about the reading dressed up as a
  // claim about the document (docs/process-overview.md §5).
  'Unread',
] as const;
export type MarkState = (typeof MARK_STATES)[number];

/**
 * One sheet of the document as the pipeline left it.
 *
 * Primitives and not the entities, so that both the run — which holds the
 * aggregate — and the detail query — which holds rows — can ask the same
 * question without one of them rebuilding the other's world. A sheet nobody
 * read is `{ text: '', confidence: 0 }`, which is exactly what an illegible
 * reading already is (`OcrResult.illegible`): a sheet that was never read and a
 * sheet that came back with nothing on it support the same conclusion about
 * the marks on it, which is none.
 */
export type SheetReading = {
  readonly text: string;
  readonly confidence: number;
};

// What the profile asks of a paper of this type, as the two answers
// `DocumentTypeSpec` carries.
export type MarkExpectations = {
  readonly expectsStamp: boolean;
  readonly expectsSignature: boolean;
};

export type MarkObservation = {
  readonly expected: boolean;
  readonly state: MarkState;
  // The legends read off the seals, in the order they were seen. Empty for a
  // signature, which has no text, and empty on any state but `Present`: a seal
  // nobody could read contributes no legend, and an empty string in this list
  // would be a name the screen could show and the inspector could not use.
  readonly legends: readonly string[];
  // 0..1, and never more than the least confident sheet of the document: a mark
  // is only as certain as the reading of the paper it was looked for on. Null
  // on `Unread`, where there is no reading to be as certain as.
  readonly confidence: number | null;
};

export type DocumentAttestation = {
  readonly stamp: MarkObservation;
  readonly signature: MarkObservation;
};

export function attestationOf(
  sheets: readonly SheetReading[],
  expects: MarkExpectations,
): DocumentAttestation {
  if (!sheets.some(sheet => wasRead(sheet))) {
    return {
      stamp: unread(expects.expectsStamp),
      signature: unread(expects.expectsSignature),
    };
  }

  const confidence = leastConfidentOf(sheets);
  const marks = attestationIn(textOf(sheets));
  const legends = marks.stamps.filter(legend => legend !== '');

  return {
    stamp: {
      expected: expects.expectsStamp,
      state: stampState(marks.stamps, legends),
      legends,
      confidence,
    },
    signature: {
      expected: expects.expectsSignature,
      state: marks.isSigned ? 'Present' : 'Absent',
      legends: [],
      confidence,
    },
  };
}

function stampState(
  stamps: readonly string[],
  legends: readonly string[],
): MarkState {
  if (stamps.length === 0) return 'Absent';

  return legends.length === 0 ? 'Illegible' : 'Present';
}

function unread(expected: boolean): MarkObservation {
  return { expected, state: 'Unread', legends: [], confidence: null };
}

function wasRead(sheet: SheetReading): boolean {
  return sheet.text.trim().length > 0;
}

// The document's reading, assembled the way the pipeline assembles it: the
// sheets that came back with something on them, in order, one per line
// (`RecognisedText.concat`).
function textOf(sheets: readonly SheetReading[]): string {
  return sheets
    .filter(sheet => wasRead(sheet))
    .map(sheet => sheet.text)
    .join('\n');
}

// A sheet that was never read supports nothing at all — which is unassessed and
// not "probably fine", so it drags the figure to zero rather than being left
// out of it (docs/process-overview.md §5).
function leastConfidentOf(sheets: readonly SheetReading[]): number {
  return sheets.reduce(
    (lowest, sheet) => Math.min(lowest, sheet.confidence),
    1,
  );
}
