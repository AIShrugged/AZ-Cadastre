/**
 * What a document's seal and signature come to on screen.
 *
 * The engine publishes two independent facts per mark (COMM-76): whether the
 * profile expects it of a paper of this type, and what the sheets actually
 * showed. The screen has to say both, always — and that is the whole reason
 * this module exists, because until COMM-77 the report only ever spoke when a
 * mark the profile wanted was missing. Presence arrived as nothing, absence
 * arrived as nothing until a finding was filed, and a document nobody could
 * read arrived as nothing too. Three different answers, one appearance: empty.
 *
 * So every placed document gets two lines, drawn whether or not there is
 * anything wrong, and the two mistakes this module is written to prevent are:
 *
 * 1. **Presence is a statement**, not the absence of a red mark. "Stamped" is a
 *    sentence the inspector reads, in the same place and at the same weight as
 *    "no stamp".
 * 2. **`Unread` is not `Absent`.** Nothing was looked at, so nothing is claimed;
 *    it gets its own wording and its own standing, and it must never be worded
 *    or drawn as "the mark is missing". Collapsing the two hands an inspector a
 *    guess dressed up as an observation.
 *
 * The wording is picked here rather than in the component so the mapping is a
 * thing that can be tested: this client has no DOM test set (ADR-0007), and the
 * decision worth guarding is which sentence each of the eight states reads as,
 * not which span it lands in.
 */
import type {
  DocumentAttestationDto,
  DocumentMarkDto,
  MarkState,
} from '@cadastre/api-contracts/verification';

export type MarkKind = 'stamp' | 'signature';

/**
 * How firmly a line is drawn — never how alarming it is.
 *
 * - `carried` — the paper carries the mark. Shown as settled, whether or not
 *   the profile asked for it: a seal found on a paper nobody asked to be sealed
 *   is still a seal that is there.
 * - `short` — the profile expects the mark and the paper does not deliver it.
 *   The report already files a finding for exactly this, and the two are one
 *   observation shown twice, so the line states the shortfall in the clay ink
 *   the rest of the surface uses for doubt rather than shouting it a second
 *   time in red.
 * - `bare` — no mark, and none was asked for. Nothing is wrong; the line exists
 *   only so the inspector can see that the question was put.
 * - `unread` — no sheet of the document was read. Says what was not looked at
 *   and claims nothing about the paper.
 */
export type MarkStanding = 'carried' | 'short' | 'bare' | 'unread';

export type MarkLine = {
  readonly kind: MarkKind;
  /** i18n key for the name of the mark — "Stamp" / "Signature". */
  readonly label: string;
  /** i18n key for the sentence the inspector reads. */
  readonly key: string;
  readonly standing: MarkStanding;
  /**
   * The legends read off the seals, to be printed beside the sentence. Empty
   * for a signature, and empty wherever there was no legend to read.
   */
  readonly legends: readonly string[];
  /**
   * How well the sheets this answer was drawn from were read, verbatim from the
   * contract. Null on `Unread`, where there is no reading to be confident about
   * — which is also why a figure never appears on that line.
   */
  readonly confidence: number | null;
};

const LABEL: Record<MarkKind, string> = {
  stamp: 'attest.stamp',
  signature: 'attest.signature',
};

/** Both marks, in the order an office applies them. */
export const MARK_KINDS: readonly MarkKind[] = ['stamp', 'signature'];

/**
 * The state as this mark can actually be in it.
 *
 * `Illegible` is a seal's answer alone — a signature is no text, so there is
 * nothing about it to fail to read, and the contract says it never arrives for
 * one. Should it ever, it is read as presence: what it asserts is that a mark
 * was seen, and answering "no signature" to that would be worse than answering
 * nothing. Normalised once, here, so the sentence and the standing cannot come
 * out of the same reading disagreeing about it.
 */
function stateOf(kind: MarkKind, mark: DocumentMarkDto): MarkState {
  return mark.state === 'Illegible' && kind === 'signature'
    ? 'Present'
    : mark.state;
}

/** Which sentence a mark reads as — eight, from two independent facts. */
function sentence(kind: MarkKind, state: MarkState, expected: boolean): string {
  const suffix = expected ? '' : '_unasked';

  switch (state) {
    case 'Present':
      return `${LABEL[kind]}.present${suffix}`;
    case 'Illegible':
      return `${LABEL[kind]}.illegible${suffix}`;
    case 'Absent':
      return `${LABEL[kind]}.absent${suffix}`;
    // Deliberately one wording for both expectations: "no sheet was read" is a
    // statement about the reading, and the reading does not change because the
    // profile wanted something. Saying "the profile expects a stamp" here would
    // read as the beginning of an accusation about a paper nobody looked at.
    case 'Unread':
      return `${LABEL[kind]}.unread`;
  }
}

function standingOf(state: MarkState, expected: boolean): MarkStanding {
  if (state === 'Unread') return 'unread';
  if (state === 'Present') return 'carried';

  if (state === 'Illegible') {
    // A seal that is there but says nothing is still a shortfall against a
    // profile that wanted to know what sealed the paper — the report files
    // `IllegibleStamp` for it. Against a profile that wanted no seal at all it
    // is simply a seal the paper carries.
    return expected ? 'short' : 'carried';
  }

  return expected ? 'short' : 'bare';
}

/** One mark, read into the line that states it. */
export function markLine(kind: MarkKind, mark: DocumentMarkDto): MarkLine {
  const state = stateOf(kind, mark);

  return {
    kind,
    label: LABEL[kind],
    key: sentence(kind, state, mark.expected),
    standing: standingOf(state, mark.expected),
    // Only a legend actually read is worth printing, and only presence has one.
    // A blank legend is what `Illegible` already says in words.
    legends:
      state === 'Present'
        ? mark.legends.filter(legend => legend.trim() !== '')
        : [],
    confidence: mark.confidence,
  };
}

/**
 * Both lines of a document's attestation, or none at all.
 *
 * `null` means the document has not been placed under a type yet, and without a
 * type there is no specification and so no answer about what the paper was
 * expected to carry. That is an empty result and not a third kind of line: a
 * document still being classified says so in its own heading, and repeating it
 * twice more underneath tells the inspector nothing.
 */
export function attestationLines(
  attestation: DocumentAttestationDto | null,
): readonly MarkLine[] {
  if (attestation === null) return [];

  return MARK_KINDS.map(kind => markLine(kind, attestation[kind]));
}
