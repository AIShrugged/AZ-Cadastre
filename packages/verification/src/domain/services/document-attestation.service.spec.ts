import { describe, expect, it } from 'vitest';

import {
  attestationOf,
  type MarkExpectations,
  type SheetReading,
} from './document-attestation.service.js';

const ATTESTED: MarkExpectations = {
  expectsStamp: true,
  expectsSignature: true,
};
const NOTHING_EXPECTED: MarkExpectations = {
  expectsStamp: false,
  expectsSignature: false,
};

// One sheet the reader got through, read as `text`.
function aSheet(text: string, confidence = 0.9): SheetReading {
  return { text, confidence };
}

// A sheet nobody read: no reading at all and an illegible one are the same
// answer about the marks on the paper, and this is the shape both arrive in.
const UNREAD: SheetReading = { text: '', confidence: 0 };

describe('attestationOf', () => {
  it('reads the legend off a seal the archive pressed', () => {
    const attestation = attestationOf(
      [aSheet('ARXİV ARAYIŞI\n[stamp: BAKI ŞƏHƏR DÖVLƏT ARXİVİ]\n[signature]')],
      ATTESTED,
    );

    expect(attestation.stamp).toEqual({
      expected: true,
      state: 'Present',
      legends: ['BAKI ŞƏHƏR DÖVLƏT ARXİVİ'],
      confidence: 0.9,
    });
    expect(attestation.signature.state).toBe('Present');
  });

  // Sealed and unreadable is not unsealed: the first sends an inspector to the
  // sheet to read the legend themselves, the second is a paper to send back.
  it('tells a seal that says nothing from no seal at all', () => {
    const unreadable = attestationOf([aSheet('[stamp: illegible]')], ATTESTED);
    const none = attestationOf([aSheet('SƏRƏNCAM')], ATTESTED);

    expect(unreadable.stamp.state).toBe('Illegible');
    expect(none.stamp.state).toBe('Absent');
  });

  // The state carries the rest. An empty string among the legends would be a
  // name the screen could print and the inspector could not use.
  it('carries only the legends that were made out, in reading order', () => {
    const attestation = attestationOf(
      [
        aSheet('[stamp: BİRİNCİ]'),
        aSheet('[stamp: illegible]\n[stamp: İKİNCİ]'),
      ],
      ATTESTED,
    );

    expect(attestation.stamp.state).toBe('Present');
    expect(attestation.stamp.legends).toEqual(['BİRİNCİ', 'İKİNCİ']);
  });

  it('leaves the legends empty on every state but Present', () => {
    expect(attestationOf([aSheet('[stamp]')], ATTESTED).stamp.legends).toEqual(
      [],
    );
    expect(attestationOf([aSheet('SƏRƏNCAM')], ATTESTED).stamp.legends).toEqual(
      [],
    );
  });

  it('answers for the signature, which has no legend of its own', () => {
    const signed = attestationOf([aSheet('ƏRİZƏ\n[signature]')], ATTESTED);
    const unsigned = attestationOf([aSheet('ƏRİZƏ')], ATTESTED);

    expect(signed.signature).toEqual({
      expected: true,
      state: 'Present',
      legends: [],
      confidence: 0.9,
    });
    expect(unsigned.signature.state).toBe('Absent');
  });

  /*
   * Nothing was looked at, so nothing is said. "No seal" here would be a claim
   * about the reading dressed up as a claim about the document — which is what
   * the report has always refused to file, and what the data has to keep
   * saying apart from a paper that was read and carries no seal.
   */
  it('says the marks were never looked at when no sheet was read', () => {
    const attestation = attestationOf([UNREAD, UNREAD], ATTESTED);

    expect(attestation.stamp).toEqual({
      expected: true,
      state: 'Unread',
      legends: [],
      confidence: null,
    });
    expect(attestation.signature.state).toBe('Unread');
  });

  it('says the same of a document with no sheets at all', () => {
    expect(attestationOf([], ATTESTED).stamp.state).toBe('Unread');
  });

  // The observation does not depend on anyone having asked for it: a seal on a
  // receipt is a fact worth showing, and the profile expecting none of it is
  // what `expected` is for.
  it('answers about a paper no office is asked to seal or sign', () => {
    const attestation = attestationOf(
      [aSheet('ÖDƏNİŞ QƏBZİ\n[stamp: BANK]')],
      NOTHING_EXPECTED,
    );

    expect(attestation.stamp).toEqual({
      expected: false,
      state: 'Present',
      legends: ['BANK'],
      confidence: 0.9,
    });
    expect(attestation.signature).toEqual({
      expected: false,
      state: 'Absent',
      legends: [],
      confidence: 0.9,
    });
  });

  // A mark is only as certain as the reading of the sheets it was looked for
  // on (docs/process-overview.md §5).
  it('is no surer than the least confident sheet of the document', () => {
    const attestation = attestationOf(
      [aSheet('ARXİV ARAYIŞI', 0.93), aSheet('[stamp: ARXİV]', 0.55)],
      ATTESTED,
    );

    expect(attestation.stamp.confidence).toBe(0.55);
    expect(attestation.signature.confidence).toBe(0.55);
  });

  // A sheet that was never read supports nothing at all, which is unassessed
  // and not "probably fine": it drags the figure to zero rather than being left
  // out of it.
  it('counts a sheet nobody read as unassessed and not as absent', () => {
    const attestation = attestationOf(
      [aSheet('ARXİV ARAYIŞI\n[stamp: ARXİV]', 0.93), UNREAD],
      ATTESTED,
    );

    expect(attestation.stamp.state).toBe('Present');
    expect(attestation.stamp.confidence).toBe(0);
  });

  // The mark is on the second sheet and the first is where the document starts:
  // the sheets are one paper, and a seal on any of them seals it.
  it('reads every sheet of the document as one paper', () => {
    const attestation = attestationOf(
      [aSheet('SƏRƏNCAM'), aSheet('[stamp: İCRA HAKİMİYYƏTİ]\n[signature]')],
      ATTESTED,
    );

    expect(attestation.stamp.legends).toEqual(['İCRA HAKİMİYYƏTİ']);
    expect(attestation.signature.state).toBe('Present');
  });
});
