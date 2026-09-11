import { describe, expect, it } from 'vitest';

import { Confidence } from '../value-objects/confidence.vo.js';
import { VerificationProfile } from '../value-objects/verification-profile.vo.js';

import { gapsIn, type ReadDocument } from './document-gaps.service.js';

/*
 * The rule that decides what an operator may send in, and why.
 *
 * Under test in its own right rather than through the aggregate, because it is
 * the one rule two sides answer with: the package refuses a supply that is not
 * on this list, and the detail query publishes the same list off rows. A second
 * implementation of it would be a second offer.
 */

const CADASTRE = VerificationProfile.CADASTRE;
const REQUIRED = CADASTRE.requiredTypes.map(type => type.value);

// Every field the profile asks of this type, read cleanly. The baseline a spec
// spoils one thing about, so that what is under test is the one thing.
function readCleanly(
  type: string,
  confidence = 0.95,
): ReadDocument['readings'] {
  return CADASTRE.schemaFor(
    CADASTRE.specs.find(spec => spec.type.value === type)!.type,
  ).specs.map(spec => ({ key: spec.key.value, confidence }));
}

function aDocument(
  type: string,
  overrides: Partial<ReadDocument> = {},
): ReadDocument {
  return {
    documentId: `document-${type}`,
    sourceFileId: `file-${type}`,
    type,
    classifiedAt: 0.97,
    readings: readCleanly(type),
    superseded: false,
    ...overrides,
  };
}

// A package the run had nothing to say about: every required paper is there and
// every one of them was read cleanly.
function aWholePackage(): readonly ReadDocument[] {
  return REQUIRED.map(type => aDocument(type));
}

function reasonsFor(
  documents: readonly ReadDocument[],
  type: string,
): readonly string[] {
  return gapsIn(CADASTRE, documents)
    .filter(gap => gap.expectedType.value === type)
    .map(gap => gap.reason);
}

describe('gapsIn', () => {
  describe('a required paper nobody sent', () => {
    it('offers every required type a package holds none of', () => {
      const gaps = gapsIn(CADASTRE, []);

      expect(
        gaps
          .filter(gap => gap.reason === 'MissingDocument')
          .map(gap => gap.expectedType.value),
      ).toEqual(REQUIRED);
    });

    it('names no document, because there is nothing here to replace', () => {
      const [gap] = gapsIn(CADASTRE, []);

      expect(gap?.documentId).toBeNull();
      expect(gap?.sourceFileId).toBeNull();
    });

    it('stops offering it once a document of that type is in force', () => {
      expect(reasonsFor(aWholePackage(), 'application')).toEqual([]);
    });

    it('offers it again once the document that answered it is replaced', () => {
      const documents = aWholePackage().map(document =>
        document.type === 'application'
          ? { ...document, superseded: true }
          : document,
      );

      expect(reasonsFor(documents, 'application')).toEqual(['MissingDocument']);
    });

    /*
     * A paper the profile does not ask for answers nothing. Only a placed type
     * of the profile's own does — `out_of_profile` and `unknown` are what the
     * reader says when it could not place the paper.
     */
    it('is not answered by a document the reader could not place', () => {
      const documents = [
        aDocument('application', { type: 'out_of_profile', readings: [] }),
      ];

      expect(reasonsFor(documents, 'application')).toEqual(['MissingDocument']);
    });
  });

  describe('a paper that is here and was read badly', () => {
    it('offers a document the profile asked a field of that its sheets did not yield', () => {
      const documents = aWholePackage().map(document =>
        document.type === 'application'
          ? { ...document, readings: document.readings.slice(1) }
          : document,
      );

      expect(reasonsFor(documents, 'application')).toEqual(['UnusableScan']);
    });

    it('offers a document with a reading under the floor, however little under', () => {
      const documents = aWholePackage().map(document =>
        document.type === 'application'
          ? {
              ...document,
              readings: readCleanly(
                'application',
                Confidence.FLOOR.value - 0.01,
              ),
            }
          : document,
      );

      expect(reasonsFor(documents, 'application')).toEqual(['UnusableScan']);
    });

    it('is content with a reading exactly at the floor', () => {
      const documents = aWholePackage().map(document =>
        document.type === 'application'
          ? {
              ...document,
              readings: readCleanly('application', Confidence.FLOOR.value),
            }
          : document,
      );

      expect(reasonsFor(documents, 'application')).toEqual([]);
    });

    // A paper the classifier half-recognised is a paper an inspector cannot
    // rely on being the right one, whatever was read off it.
    it('offers a document placed under the floor even where every field read', () => {
      const documents = aWholePackage().map(document =>
        document.type === 'application'
          ? { ...document, classifiedAt: Confidence.FLOOR.value - 0.05 }
          : document,
      );

      expect(reasonsFor(documents, 'application')).toEqual(['UnusableScan']);
    });

    it('names the document and its file, so the offer can open the scan', () => {
      const documents = aWholePackage().map(document =>
        document.type === 'application'
          ? { ...document, readings: [] }
          : document,
      );

      const [gap] = gapsIn(CADASTRE, documents).filter(
        one => one.reason === 'UnusableScan',
      );

      expect(gap?.documentId).toBe('document-application');
      expect(gap?.sourceFileId).toBe('file-application');
    });

    // The replaced scan is history. Offering it again would ask the operator to
    // better a paper the package no longer stands on.
    it('says nothing about a document a later arrival has replaced', () => {
      const documents = aWholePackage().map(document =>
        document.type === 'application'
          ? { ...document, readings: [], superseded: true }
          : document,
      );

      expect(reasonsFor(documents, 'application')).toEqual(['MissingDocument']);
    });
  });

  describe('a paper the profile takes at any time', () => {
    it('offers the payment receipt on a package with nothing wrong with it', () => {
      expect(reasonsFor(aWholePackage(), 'payment_receipt')).toEqual([
        'AlwaysAccepted',
      ]);
    });

    /*
     * One entry and not two. The receipt is a required type as well, so a
     * package that never carried one is short of it — and that is
     * `MissingDocument`, which says the truer thing. Publishing both would put
     * one type on the screen twice under two headings.
     */
    it('does not repeat a required paper the package is short of', () => {
      expect(reasonsFor([], 'payment_receipt')).toEqual(['MissingDocument']);
    });

    // Two offers here, and they are different offers: one replaces the scan
    // that was read badly, the other is a receipt sent in beside it.
    it('stands beside the replacement offer for a receipt that read badly', () => {
      const documents = aWholePackage().map(document =>
        document.type === 'payment_receipt'
          ? { ...document, readings: [] }
          : document,
      );

      expect(reasonsFor(documents, 'payment_receipt')).toEqual([
        'UnusableScan',
        'AlwaysAccepted',
      ]);
    });
  });
});
