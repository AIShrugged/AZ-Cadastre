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
const TITLES = CADASTRE.provisions!.titleTypes.map(type => type.value);

// Every field the profile asks of this type, read cleanly. The baseline a spec
// spoils one thing about, so that what is under test is the one thing.
function readCleanly(
  type: string,
  confidence = 0.95,
): ReadDocument['readings'] {
  return CADASTRE.schemaFor(
    CADASTRE.specs.find(spec => spec.type.value === type)!.type,
  ).specs.map(spec => ({
    key: spec.key.value,
    value: 'read',
    confidence,
    pageNumber: 1,
  }));
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

// One document read with exactly these values, and nothing else.
function aDocumentStating(
  type: string,
  values: Readonly<Record<string, string>>,
): ReadDocument {
  return aDocument(type, {
    readings: Object.entries(values).map(([key, value]) => ({
      key,
      value,
      confidence: 0.95,
      pageNumber: 1,
    })),
  });
}

// A package the run had nothing to say about: every required paper, a title to
// the land and a receipt for the duty, each read cleanly.
function aWholePackage(): readonly ReadDocument[] {
  return [...REQUIRED, 'registration_certificate', 'payment_receipt'].map(
    type => aDocument(type),
  );
}

function reasonsFor(
  documents: readonly ReadDocument[],
  type: string,
): readonly string[] {
  return gapsIn(CADASTRE, documents)
    .filter(gap => gap.expectedType.value === type)
    .map(gap => gap.reason);
}

function missingIn(
  documents: readonly ReadDocument[],
  declared?: Parameters<typeof gapsIn>[2],
): readonly string[] {
  return gapsIn(CADASTRE, documents, declared)
    .filter(gap => gap.reason === 'MissingDocument')
    .map(gap => gap.expectedType.value);
}

describe('gapsIn', () => {
  describe('a required paper nobody sent', () => {
    it('offers every required type a package holds none of', () => {
      expect(missingIn([]).filter(type => REQUIRED.includes(type))).toEqual(
        REQUIRED,
      );
    });

    it('names no document, because there is nothing here to replace', () => {
      const [gap] = gapsIn(CADASTRE, []);

      expect(gap?.documentId).toBeNull();
      expect(gap?.sourceFileId).toBeNull();
    });

    it('stops offering it once a document of that type is in force', () => {
      expect(reasonsFor(aWholePackage(), 'sketch_project')).toEqual([]);
    });

    it('offers it again once the document that answered it is replaced', () => {
      const documents = aWholePackage().map(document =>
        document.type === 'sketch_project'
          ? { ...document, superseded: true }
          : document,
      );

      expect(reasonsFor(documents, 'sketch_project')).toEqual([
        'MissingDocument',
      ]);
    });

    /*
     * A paper the profile does not ask for answers nothing. Only a placed type
     * of the profile's own does — `out_of_profile` and `unknown` are what the
     * reader says when it could not place the paper.
     */
    it('is not answered by a document the reader could not place', () => {
      const documents = [
        aDocument('sketch_project', { type: 'out_of_profile', readings: [] }),
      ];

      expect(reasonsFor(documents, 'sketch_project')).toEqual([
        'MissingDocument',
      ]);
    });
  });

  /*
   * The title to the land every provision asks for (ADR-0025). Any of the
   * titles answers it, and a gap names one type, so which ones are offered is
   * decided here: what was declared at intake, otherwise the class the
   * provision rests on, otherwise all of them.
   */
  describe('a title to the land nobody sent', () => {
    it('offers every title where nothing narrows which one', () => {
      expect(missingIn([]).filter(type => TITLES.includes(type))).toEqual(
        TITLES,
      );
    });

    it('offers only the ground the office declared at intake', () => {
      expect(
        missingIn([], {
          legalBasis: 'household_book_extract',
          builtYear: null,
        }).filter(type => TITLES.includes(type)),
      ).toEqual(['household_book_extract']);
    });

    // 8.0.9.1.2 is registered on an ownership document: a lease document would
    // not found the case, so it is not what the operator is asked for.
    it('offers only the titles of the class the provision rests on', () => {
      const documents = [
        aDocumentStating('land_plot_plan', {
          land_category: 'Fərdi yaşayış tikintisi üçün torpaq',
          right_type: 'Mülkiyyət hüququ',
        }),
        aDocumentStating('sketch_project', { building_height: '8 m' }),
      ];

      expect(
        missingIn(documents, { legalBasis: null, builtYear: 2010 }).filter(
          type => TITLES.includes(type),
        ),
      ).toEqual([
        'state_register_extract',
        'land_right_state_act',
        'registration_certificate',
        'property_right_certificate',
      ]);
    });

    it('offers no title once one is in force', () => {
      expect(
        missingIn(aWholePackage()).filter(type => TITLES.includes(type)),
      ).toEqual([]);
    });
  });

  describe('a paper the provision asks for that nobody sent', () => {
    const POST_2013 = [
      aDocumentStating('land_plot_plan', {
        land_category: 'Fərdi yaşayış tikintisi üçün torpaq',
      }),
      aDocumentStating('sketch_project', {
        storeys: '2',
        building_height: '7,4 m',
        span_dimensions: 'A—B 4,20 m',
      }),
      aDocument('disposal_order'),
    ];

    it('offers every paper of the provision the case was decided under', () => {
      expect(
        missingIn(POST_2013, { legalBasis: null, builtYear: 2014 }),
      ).toEqual([
        'architectural_planning_section',
        'construction_completion_notice',
      ]);
    });

    // Which papers are owed is the question the report asks the inspector;
    // offering the union would ask for papers no provision of the case needs.
    it('offers none while the provision is undecided', () => {
      expect(
        missingIn(POST_2013, { legalBasis: null, builtYear: null }),
      ).toEqual([]);
    });
  });

  describe('a paper that is here and was read badly', () => {
    it('offers a document the profile asked a field of that its sheets did not yield', () => {
      const documents = aWholePackage().map(document =>
        document.type === 'sketch_project'
          ? { ...document, readings: document.readings.slice(1) }
          : document,
      );

      expect(reasonsFor(documents, 'sketch_project')).toEqual(['UnusableScan']);
    });

    it('offers a document with a reading under the floor, however little under', () => {
      const documents = aWholePackage().map(document =>
        document.type === 'sketch_project'
          ? {
              ...document,
              readings: readCleanly(
                'sketch_project',
                Confidence.FLOOR.value - 0.01,
              ),
            }
          : document,
      );

      expect(reasonsFor(documents, 'sketch_project')).toEqual(['UnusableScan']);
    });

    it('is content with a reading exactly at the floor', () => {
      const documents = aWholePackage().map(document =>
        document.type === 'sketch_project'
          ? {
              ...document,
              readings: readCleanly('sketch_project', Confidence.FLOOR.value),
            }
          : document,
      );

      expect(reasonsFor(documents, 'sketch_project')).toEqual([]);
    });

    // A paper the classifier half-recognised is a paper an inspector cannot
    // rely on being the right one, whatever was read off it.
    it('offers a document placed under the floor even where every field read', () => {
      const documents = aWholePackage().map(document =>
        document.type === 'sketch_project'
          ? { ...document, classifiedAt: Confidence.FLOOR.value - 0.05 }
          : document,
      );

      expect(reasonsFor(documents, 'sketch_project')).toEqual(['UnusableScan']);
    });

    it('names the document and its file, so the offer can open the scan', () => {
      const documents = aWholePackage().map(document =>
        document.type === 'sketch_project'
          ? { ...document, readings: [] }
          : document,
      );

      const [gap] = gapsIn(CADASTRE, documents).filter(
        one => one.reason === 'UnusableScan',
      );

      expect(gap?.documentId).toBe('document-sketch_project');
      expect(gap?.sourceFileId).toBe('file-sketch_project');
    });

    // The replaced scan is history. Offering it again would ask the operator to
    // better a paper the package no longer stands on.
    it('says nothing about a document a later arrival has replaced', () => {
      const documents = aWholePackage().map(document =>
        document.type === 'sketch_project'
          ? { ...document, readings: [], superseded: true }
          : document,
      );

      expect(reasonsFor(documents, 'sketch_project')).toEqual([
        'MissingDocument',
      ]);
    });
  });

  describe('a paper the profile takes at any time', () => {
    it('offers the payment receipt on a package with nothing wrong with it', () => {
      expect(reasonsFor(aWholePackage(), 'payment_receipt')).toEqual([
        'AlwaysAccepted',
      ]);
    });

    /*
     * The receipt is required of nobody since ADR-0025 — the duty is paid once
     * the application is approved — so a package that never carried one is not
     * short of it. It is offered once, as a paper the profile takes whenever it
     * turns up.
     */
    it('offers it once, and as an offer, to a package that never carried one', () => {
      expect(reasonsFor([], 'payment_receipt')).toEqual(['AlwaysAccepted']);
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
