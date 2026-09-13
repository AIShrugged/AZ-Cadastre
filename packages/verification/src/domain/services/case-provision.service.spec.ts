import { describe, expect, it } from 'vitest';

import { ARTICLE_8_PROVISIONS } from '../value-objects/article-8-provisions.table.js';
import { ProvisionsSpec } from '../value-objects/provision.vo.js';

import { provisionOf } from './case-provision.service.js';
import type { ReadDocument } from './document-gaps.service.js';

/*
 * Which provision a package's case falls under, worked out off the readings the
 * package holds (ADR-0025).
 *
 * The decision table itself is held to the acceptance contract in
 * `provision.vo.spec.ts`. What is under test here is the other half: which
 * paper each figure is believed from, what happens when that paper said
 * something that cannot be understood, and how the package answers what the
 * provision asks for.
 */

const TABLE = ProvisionsSpec.of(ARTICLE_8_PROVISIONS);

let sequence = 0;

function aDocument(
  type: string,
  readings: Record<string, string> = {},
  overrides: Partial<ReadDocument> = {},
): ReadDocument {
  sequence += 1;

  return {
    documentId: `document-${sequence}`,
    sourceFileId: `file-${sequence}`,
    type,
    classifiedAt: 0.96,
    readings: Object.entries(readings).map(([key, value]) => ({
      key,
      value,
      confidence: 0.93,
      pageNumber: 2,
    })),
    superseded: false,
    ...overrides,
  };
}

// A two-storey house of 7.4 m with 4.2 m spans on a plot designated for housing
// — the contract's BASE, as papers would state it.
function aDesign(): ReadDocument {
  return aDocument('sketch_project', {
    storeys: '2',
    building_height: '7,4 m',
    span_dimensions: 'A—B 4,20 m; B—C 3,60 m',
  });
}

function aPlan(): ReadDocument {
  return aDocument('land_plot_plan', {
    land_category: 'Fərdi yaşayış tikintisi üçün torpaq',
  });
}

describe('provisionOf', () => {
  describe('the year the case is dated by', () => {
    it('takes what the office declared at intake before any paper', () => {
      const acceptance = aDocument('operation_acceptance_act', {
        act_date: '14.03.2011',
      });
      const answer = provisionOf(TABLE, 2014, [acceptance]);

      expect(answer.parameters.builtYear).toBe(2014);
      expect(answer.readings[0]).toMatchObject({
        parameter: 'builtYear',
        source: 'DeclaredAtIntake',
        stated: '2014',
        from: null,
      });
    });

    it('reads it off the paper that closed the construction where nothing was declared', () => {
      const acceptance = aDocument('operation_acceptance_act', {
        act_date: '14.03.2011',
      });
      const answer = provisionOf(TABLE, null, [acceptance]);

      expect(answer.parameters.builtYear).toBe(2011);
      expect(answer.readings[0]?.source).toBe('ReadOffDocument');
      expect(answer.readings[0]?.from).toMatchObject({
        documentId: acceptance.documentId,
        fieldKey: 'act_date',
        pageNumber: 2,
      });
    });

    // A design approved in 2012 is a house built in 2014 as often as not.
    it('does not date the case by the design’s approval', () => {
      const design = aDocument('sketch_project', {
        approval_date: '18.12.2012',
      });

      expect(provisionOf(TABLE, null, [design]).parameters.builtYear).toBe(
        null,
      );
    });
  });

  describe('a figure read off a paper', () => {
    it('is believed from the first paper of the profile’s order that states it', () => {
      const answer = provisionOf(TABLE, 2014, [aDesign(), aPlan()]);

      expect(answer.parameters).toEqual({
        builtYear: 2014,
        storeys: 2,
        height: 7.4,
        span: 4.2,
        landRight: null,
        purpose: 'Residential',
      });
    });

    /*
     * "2 mərtəbə" on the height line is two storeys and no height. Falling
     * through to a paper the profile believes less would decide the case on it
     * without anybody being told; the figure stays unstated and the words that
     * were refused stay beside it.
     */
    it('stays unstated when the first reading cannot be understood, and keeps what was read', () => {
      const design = aDocument('sketch_project', {
        building_height: '2 mərtəbə',
      });
      const approved = aDocument('approved_design', {
        building_height: '7,4 m',
      });
      const answer = provisionOf(TABLE, 2014, [approved, design]);

      expect(answer.parameters.height).toBeNull();
      expect(
        answer.readings.find(reading => reading.parameter === 'height'),
      ).toMatchObject({ source: 'ReadOffDocument', stated: '2 mərtəbə' });
    });

    it('is not read off a document a later arrival replaced', () => {
      const replaced = aDocument(
        'sketch_project',
        { building_height: '15 m' },
        { superseded: true },
      );

      expect(provisionOf(TABLE, 2014, [replaced]).parameters.height).toBeNull();
    });

    it('is not read off a document the classifier could not place', () => {
      const unplaced = aDocument('unknown', { building_height: '15 m' });

      expect(provisionOf(TABLE, 2014, [unplaced]).parameters.height).toBeNull();
    });
  });

  describe('the right over the land', () => {
    it('is decided by the kind of title document the package carries', () => {
      const act = aDocument('land_right_state_act', { issue_date: '1995' });
      const answer = provisionOf(TABLE, 2010, [act]);

      expect(answer.parameters.landRight).toBe('Ownership');
      expect(
        answer.readings.find(reading => reading.parameter === 'landRight'),
      ).toMatchObject({
        source: 'TitleDocumentType',
        from: { documentId: act.documentId, fieldKey: null },
      });
    });

    it('is decided by the title document before anything a plan words', () => {
      const plan = aDocument('land_plot_plan', {
        right_type: 'Mülkiyyət hüququ',
      });
      const household = aDocument('household_book_extract', {
        issue_date: '1987',
      });

      expect(
        provisionOf(TABLE, 2010, [plan, household]).parameters.landRight,
      ).toBe('LeaseOrUse');
    });

    it('is read off the wording where the package carries no title document', () => {
      const plan = aDocument('land_plot_plan', {
        right_type: 'Mülkiyyət hüququ',
      });

      expect(provisionOf(TABLE, 2010, [plan]).parameters.landRight).toBe(
        'Ownership',
      );
    });

    // Which of two titles of different classes the case stands on is the
    // inspector's to say.
    it('is left unstated where two title documents confer different rights', () => {
      const act = aDocument('land_right_state_act');
      const household = aDocument('household_book_extract');
      const answer = provisionOf(TABLE, 2010, [act, household]);

      expect(answer.parameters.landRight).toBeNull();
      expect(
        answer.readings.find(reading => reading.parameter === 'landRight')
          ?.stated,
      ).toBe('Ownership, LeaseOrUse');
    });
  });

  describe('what the provision asks for', () => {
    it('shows the requirements of the provision the case was decided under', () => {
      const answer = provisionOf(TABLE, 2014, [aDesign(), aPlan()]);

      expect(answer.decision.outcome).toBe('Determined');
      expect(answer.provisions.map(one => one.provision)).toEqual(['8.0.10.2']);
      expect(answer.provisions[0]?.requirements).toEqual([
        {
          anyOf: ['architectural_planning_section'],
          onlyBuiltBefore: null,
          applies: true,
          answered: false,
        },
        {
          anyOf: ['construction_completion_notice'],
          onlyBuiltBefore: 2026,
          applies: true,
          answered: false,
        },
      ]);
    });

    it('counts a group answered by any one of its papers', () => {
      const lease = aDocument('homestead_land_allocation_decision', {
        issue_date: '12.05.1995',
      });
      const acceptance = aDocument('operation_acceptance_act');
      const design = aDocument('sketch_project', { building_height: '8 m' });
      const answer = provisionOf(TABLE, 2010, [lease, acceptance, design]);

      expect(answer.provisions.map(one => one.provision)).toEqual([
        '8.0.9.1.1',
      ]);
      expect(answer.provisions[0]?.requirements[0]?.answered).toBe(true);
    });

    // From 2026 the notification reaches the registry through the Urban
    // Planning Committee's system and not on paper.
    it('does not ask for the notification letter of a house built from 2026', () => {
      const answer = provisionOf(TABLE, 2026, [aDesign(), aPlan()]);

      expect(answer.provisions[0]?.requirements[1]?.applies).toBe(false);
    });

    it('shows every candidate’s requirements where the case is ambiguous', () => {
      const answer = provisionOf(TABLE, 2014, [aPlan()]);

      expect(answer.decision.outcome).toBe('Ambiguous');
      expect(answer.provisions.map(one => one.provision)).toEqual([
        '8.0.10.2',
        '8.0.10.1',
      ]);
    });

    it('shows none where no provision covers the case', () => {
      const plan = aDocument('land_plot_plan', {
        land_category: 'Kənd təsərrüfatı təyinatlı torpaqlar',
        right_type: 'Mülkiyyət hüququ',
      });
      const design = aDocument('sketch_project', { building_height: '8 m' });
      const answer = provisionOf(TABLE, 2010, [plan, design]);

      expect(answer.decision.outcome).toBe('Undetermined');
      expect(answer.provisions).toEqual([]);
    });
  });

  describe('a title document’s window', () => {
    // TC-08 and TC-09 of the acceptance contract.
    it('admits a homestead allocation decision of 1995', () => {
      const decision = aDocument('homestead_land_allocation_decision', {
        issue_date: '12.05.1995',
      });
      const [standing] = provisionOf(TABLE, 2010, [decision]).titleDocuments;

      expect(standing).toMatchObject({
        documentId: decision.documentId,
        landRight: 'LeaseOrUse',
        withinWindow: true,
        dated: { fieldKey: 'issue_date', value: '12.05.1995' },
      });
    });

    it('refuses one of 2003', () => {
      const decision = aDocument('homestead_land_allocation_decision', {
        issue_date: '10.04.2003',
      });

      expect(
        provisionOf(TABLE, 2010, [decision]).titleDocuments[0]?.withinWindow,
      ).toBe(false);
    });

    it('admits a paper any of whose items admits its date', () => {
      // Item 1.4 runs to 2006; item 2.2 closed in 1995.
      const decision = aDocument('land_allocation_decision', {
        issue_date: '03.03.1999',
      });
      const [standing] = provisionOf(TABLE, 2010, [decision]).titleDocuments;

      expect(standing?.withinWindow).toBe(true);
      expect(standing?.items).toEqual([
        {
          item: '1.4',
          window: 'before 2006-07-06',
          issuedFrom: null,
          issuedBefore: '2006-07-06',
          admits: true,
        },
        {
          item: '2.2',
          window: 'from 1991-11-09 to before 1995-12-19',
          issuedFrom: '1991-11-09',
          issuedBefore: '1995-12-19',
          admits: false,
        },
      ]);
    });

    it('cannot say for a title whose date went unread', () => {
      const decision = aDocument('homestead_land_allocation_decision');
      const [standing] = provisionOf(TABLE, 2010, [decision]).titleDocuments;

      expect(standing?.withinWindow).toBeNull();
      expect(standing?.dated).toBeNull();
    });

    it('lists no standing for a paper that is no title', () => {
      expect(provisionOf(TABLE, 2010, [aDesign()]).titleDocuments).toEqual([]);
    });
  });
});
