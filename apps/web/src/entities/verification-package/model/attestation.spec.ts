import { describe, expect, it } from 'vitest';

import type {
  DocumentAttestationDto,
  DocumentMarkDto,
  MarkState,
} from '@cadastre/api-contracts/verification';

import { attestationLines, MARK_KINDS, markLine } from './attestation';

const mark = (
  state: MarkState,
  expected: boolean,
  extra: Partial<DocumentMarkDto> = {},
): DocumentMarkDto => ({
  expected,
  state,
  legends: [],
  confidence: state === 'Unread' ? null : 0.93,
  ...extra,
});

describe('a seal the profile expects', () => {
  it('states that the paper is sealed, and names what sealed it', () => {
    const line = markLine(
      'stamp',
      mark('Present', true, { legends: ['State Committee on Property'] }),
    );

    expect(line.key).toBe('attest.stamp.present');
    expect(line.standing).toBe('carried');
    expect(line.legends).toEqual(['State Committee on Property']);
  });

  it('says the seal is there and its legend is not, when it cannot be read', () => {
    const line = markLine('stamp', mark('Illegible', true));

    expect(line.key).toBe('attest.stamp.illegible');
    // The report files `IllegibleStamp` for this — the paper was wanted sealed
    // with something nameable and is not.
    expect(line.standing).toBe('short');
    expect(line.legends).toEqual([]);
  });

  it('states the shortfall when the sheets carry no seal', () => {
    const line = markLine('stamp', mark('Absent', true));

    expect(line.key).toBe('attest.stamp.absent');
    expect(line.standing).toBe('short');
  });
});

describe('a seal the profile does not ask for', () => {
  // The point of publishing expectation and observation apart: a seal on a
  // paper nobody asked to be sealed is a fact worth showing, not a non-answer.
  it('still says the paper is sealed', () => {
    const line = markLine(
      'stamp',
      mark('Present', false, { legends: ['Notary of Baku'] }),
    );

    expect(line.key).toBe('attest.stamp.present_unasked');
    expect(line.standing).toBe('carried');
    expect(line.legends).toEqual(['Notary of Baku']);
  });

  it('reads an unreadable legend as a seal that is simply there', () => {
    const line = markLine('stamp', mark('Illegible', false));

    expect(line.key).toBe('attest.stamp.illegible_unasked');
    // Nothing was expected, so nothing falls short.
    expect(line.standing).toBe('carried');
  });

  it('says the seal is absent without holding it against the paper', () => {
    const line = markLine('stamp', mark('Absent', false));

    expect(line.key).toBe('attest.stamp.absent_unasked');
    expect(line.standing).toBe('bare');
  });
});

/**
 * The distinction the task was raised for. `Unread` is a statement about the
 * reading, `Absent` a statement about the paper — if the two ever come out
 * alike, an inspector is handed a guess as an observation.
 */
describe('a document no sheet of which was read', () => {
  it.each(MARK_KINDS)('says nothing about the %s either way', kind => {
    const looked = markLine(kind, mark('Absent', true));
    const unlooked = markLine(kind, mark('Unread', true));

    expect(unlooked.key).not.toBe(looked.key);
    expect(unlooked.standing).toBe('unread');
    expect(unlooked.standing).not.toBe(looked.standing);
  });

  it('words it the same whether or not the profile wanted the mark', () => {
    expect(markLine('stamp', mark('Unread', true)).key).toBe(
      markLine('stamp', mark('Unread', false)).key,
    );
  });

  it('carries no confidence, because there is no reading to be sure of', () => {
    expect(markLine('stamp', mark('Unread', true)).confidence).toBeNull();
  });
});

describe('a signature', () => {
  it('states that the paper is signed', () => {
    expect(markLine('signature', mark('Present', true)).key).toBe(
      'attest.signature.present',
    );
  });

  it('states the shortfall when it is not', () => {
    const line = markLine('signature', mark('Absent', true));

    expect(line.key).toBe('attest.signature.absent');
    expect(line.standing).toBe('short');
  });

  it('says so plainly when none was asked for', () => {
    const line = markLine('signature', mark('Absent', false));

    expect(line.key).toBe('attest.signature.absent_unasked');
    expect(line.standing).toBe('bare');
  });

  // A signature is no text, so the contract never sends `Illegible` for one.
  // Should it ever, what it asserts is that a mark was seen — answering "no
  // signature" to that would be worse than answering nothing.
  it('reads an illegible answer it should never get as presence', () => {
    const line = markLine('signature', mark('Illegible', true));

    expect(line.key).toBe('attest.signature.present');
    expect(line.standing).toBe('carried');
  });
});

describe('the pair of lines a document is drawn with', () => {
  const attestation: DocumentAttestationDto = {
    stamp: mark('Present', true, { legends: ['State Committee'] }),
    signature: mark('Absent', true),
  };

  it('draws both marks, in the order an office applies them', () => {
    expect(attestationLines(attestation).map(line => line.kind)).toEqual([
      'stamp',
      'signature',
    ]);
  });

  it('shows presence and absence side by side at equal weight', () => {
    const [stamp, signature] = attestationLines(attestation);

    expect(stamp?.standing).toBe('carried');
    expect(signature?.standing).toBe('short');
  });

  it('keeps the confidence of the reading each answer was drawn from', () => {
    expect(attestationLines(attestation).map(line => line.confidence)).toEqual([
      0.93, 0.93,
    ]);
  });

  // An unplaced document has no specification behind it, so there is no answer
  // about expectation to give — and its heading already says it is being
  // classified.
  it('draws nothing for a document that has not been placed', () => {
    expect(attestationLines(null)).toEqual([]);
  });
});

describe('the legends printed beside a seal', () => {
  it('drops a blank legend rather than printing an empty quote', () => {
    const line = markLine(
      'stamp',
      mark('Present', true, { legends: ['Notary of Baku', '   ', ''] }),
    );

    expect(line.legends).toEqual(['Notary of Baku']);
  });

  it.each<MarkState>(['Illegible', 'Absent', 'Unread'])(
    'prints none for %s, where nothing was read off a seal',
    state => {
      expect(
        markLine('stamp', mark(state, true, { legends: ['leftover'] })).legends,
      ).toEqual([]);
    },
  );
});
