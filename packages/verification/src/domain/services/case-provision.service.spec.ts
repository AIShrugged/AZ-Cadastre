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

// An act of acceptance into operation of that year: a paper the case is dated
// by, and one no provision from 2013 asks for.
function anActOf(year: number): ReadDocument {
  return aDocument('operation_acceptance_act', { act_date: `14.03.${year}` });
}

describe('provisionOf', () => {
  describe('the year the case is dated by', () => {
    it('reads it off the paper that closed the construction', () => {
      const acceptance = aDocument('operation_acceptance_act', {
        act_date: '14.03.2011',
      });
      const answer = provisionOf(TABLE, [acceptance]);

      expect(answer.parameters.builtYear).toBe(2011);
      expect(answer.readings[0]?.source).toBe('ReadOffDocument');
      expect(answer.readings[0]?.from).toMatchObject({
        documentId: acceptance.documentId,
        fieldKey: 'act_date',
        pageNumber: 2,
      });
    });

    it('takes the year a technical passport states before the date of any act', () => {
      const acceptance = aDocument('operation_acceptance_act', {
        act_date: '14.03.2011',
      });
      const passport = aDocument('technical_passport', { built_year: '1987' });
      const answer = provisionOf(TABLE, [acceptance, passport]);

      expect(answer.parameters.builtYear).toBe(1987);
      expect(answer.readings[0]?.from).toMatchObject({
        documentId: passport.documentId,
        fieldKey: 'built_year',
      });
    });

    /*
     * The year declared at intake used to date the case before any paper did
     * (ADR-0025); the year is read off the papers alone now (ADR-0026). A case
     * no paper dates stays undecided on the year rather than being dated by
     * the counter.
     */
    it('stays unstated where no paper dates the case', () => {
      expect(provisionOf(TABLE, [aDesign(), aPlan()]).readings[0]).toEqual({
        parameter: 'builtYear',
        source: null,
        stated: null,
        from: null,
        calculation: null,
      });
    });

    // A design approved in 2012 is a house built in 2014 as often as not.
    it('does not date the case by the design’s approval', () => {
      const design = aDocument('sketch_project', {
        approval_date: '18.12.2012',
      });

      expect(provisionOf(TABLE, [design]).parameters.builtYear).toBe(null);
    });
  });

  describe('a figure read off a paper', () => {
    it('is believed from the first paper of the profile’s order that states it', () => {
      const answer = provisionOf(TABLE, [aDesign(), aPlan(), anActOf(2014)]);

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
      const answer = provisionOf(TABLE, [approved, design]);

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

      expect(provisionOf(TABLE, [replaced]).parameters.height).toBeNull();
    });

    it('is not read off a document the classifier could not place', () => {
      const unplaced = aDocument('unknown', { building_height: '15 m' });

      expect(provisionOf(TABLE, [unplaced]).parameters.height).toBeNull();
    });
  });

  /*
   * The span is calculated, not read (ADR-0043): the sample design the contract
   * works its rule on, with its axis chains in bare millimetres, its built-up
   * area, and the studio that runs from axis A over axis B to axis C.
   */
  describe('the span', () => {
    function theSampleDesign(extra = ''): ReadDocument {
      return aDocument('sketch_project', {
        storeys: '2',
        building_height: '6,20 m',
        built_up_area: '130.2 m²',
        span_dimensions:
          '1—2 4000; 2—3 4400; A—B 2400; B—C 5200; C—D 2800; D—E 4000' + extra,
      });
    }

    it('is the longest span between adjacent axes, in the unit the built-up area confirms', () => {
      const answer = provisionOf(TABLE, [theSampleDesign(), aPlan()]);
      const span = answer.readings.find(one => one.parameter === 'span');

      expect(answer.parameters.span).toBeCloseTo(5.2, 9);
      expect(span?.from).toMatchObject({ fieldKey: 'span_dimensions' });
      expect(span?.calculation).toMatchObject({
        unit: 'mm',
        unitBasis: 'BuiltUpArea',
      });
      expect(span?.calculation?.chains.map(chain => chain.longest)).toEqual([
        { from: '2', to: '3', length: 4.4 },
        { from: 'B', to: 'C', length: 5.2 },
      ]);
    });

    // A room read as a span put a house of 5.2 m spans under the permit
    // procedure: 7.6 m is over six.
    it('does not take a room that crosses an axis for a span', () => {
      const answer = provisionOf(TABLE, [
        theSampleDesign('; A—C 7600; 1—3 8400'),
        aPlan(),
        anActOf(2014),
      ]);

      expect(answer.parameters.span).toBeCloseTo(5.2, 9);
      expect(answer.decision).toMatchObject({
        outcome: 'Determined',
        provision: { provision: '8.0.10.2' },
      });
    });

    it('carries no calculation for any other figure', () => {
      const answer = provisionOf(TABLE, [theSampleDesign(), aPlan()]);

      expect(
        answer.readings
          .filter(one => one.parameter !== 'span')
          .map(one => one.calculation),
      ).toEqual([null, null, null, null, null]);
    });

    it('stays unstated, with nothing calculated, where no paper states it', () => {
      const span = provisionOf(TABLE, [aPlan()]).readings.find(
        one => one.parameter === 'span',
      );

      expect(span).toMatchObject({ source: null, calculation: null });
    });
  });

  describe('the right over the land', () => {
    it('is decided by the kind of title document the package carries', () => {
      const act = aDocument('land_right_state_act', { issue_date: '1995' });
      const answer = provisionOf(TABLE, [act]);

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

      expect(provisionOf(TABLE, [plan, household]).parameters.landRight).toBe(
        'LeaseOrUse',
      );
    });

    it('is read off the wording where the package carries no title document', () => {
      const plan = aDocument('land_plot_plan', {
        right_type: 'Mülkiyyət hüququ',
      });

      expect(provisionOf(TABLE, [plan]).parameters.landRight).toBe('Ownership');
    });

    // Which of two titles of different classes the case stands on is the
    // inspector's to say.
    it('is left unstated where two title documents confer different rights', () => {
      const act = aDocument('land_right_state_act');
      const household = aDocument('household_book_extract');
      const answer = provisionOf(TABLE, [act, household]);

      expect(answer.parameters.landRight).toBeNull();
      expect(
        answer.readings.find(reading => reading.parameter === 'landRight')
          ?.stated,
      ).toBe('Ownership, LeaseOrUse');
    });
  });

  /*
   * The order allotting the parcel is a lease-or-use title under items 1.4 and
   * 2.7 — the customer's answer of 2026-09-16 — and the class of a title
   * decides the right whatever an extract or a plan words (ADR-0030, which
   * supersedes decision 3 of ADR-0026).
   */
  describe('the order of an executive authority allotting the parcel', () => {
    // A two-storey house of 7.4 m, built in 2010, on a plot for housing.
    function aPre2013Case(...titles: readonly ReadDocument[]) {
      return provisionOf(TABLE, [
        aDesign(),
        aPlan(),
        aDocument('operation_permit', { permit_date: '20.04.2010' }),
        ...titles,
      ]);
    }

    it('is a lease-or-use title, listed under items 1.4 and 2.7', () => {
      const order = aDocument('disposal_order', { issue_date: '15.04.1999' });
      const [standing] = provisionOf(TABLE, [order]).titleDocuments;

      expect(standing).toMatchObject({
        documentType: 'disposal_order',
        landRight: 'LeaseOrUse',
        withinWindow: true,
      });
      expect(standing?.items.map(one => one.item)).toEqual(['1.4', '2.7']);
    });

    it('sends a pre-2013 case of no more than 12 m on it alone to 8.0.9.1.1, which asks for a design or an acceptance act', () => {
      const order = aDocument('disposal_order', { issue_date: '15.04.1999' });
      const answer = aPre2013Case(order);

      expect(answer.parameters.landRight).toBe('LeaseOrUse');
      expect(
        answer.readings.find(reading => reading.parameter === 'landRight'),
      ).toMatchObject({
        source: 'TitleDocumentType',
        from: { documentId: order.documentId, fieldKey: null },
      });
      expect(answer.decision.outcome).toBe('Determined');
      expect(answer.provisions.map(one => one.provision)).toEqual([
        '8.0.9.1.1',
      ]);
      expect(answer.provisions[0]?.requirements).toEqual([
        {
          anyOf: ['approved_design', 'operation_acceptance_act'],
          onlyBuiltBefore: null,
          applies: true,
          answered: false,
        },
      ]);
      expect(answer.titleDocuments[0]?.wrongClassFor).toEqual([]);
    });

    // Item 1.4 runs to the Law, item 2.7 to 2001: a paper either admits is a
    // title.
    it('is a title while either of its items admits its date', () => {
      const [standing] = provisionOf(TABLE, [
        aDocument('disposal_order', { issue_date: '03.03.2004' }),
      ]).titleDocuments;

      expect(standing?.withinWindow).toBe(true);
      expect(standing?.items.map(one => one.admits)).toEqual([true, false]);
    });

    it('is no title once dated after both its windows, and decides no right', () => {
      const order = aDocument('disposal_order', { issue_date: '12.09.2011' });
      const answer = provisionOf(TABLE, [order]);

      expect(answer.titleDocuments[0]?.withinWindow).toBe(false);
      expect(answer.parameters.landRight).toBeNull();
    });

    it('decides the right before anything a plan words', () => {
      const plan = aDocument('land_plot_plan', {
        right_type: 'Mülkiyyət hüququ',
      });

      expect(
        provisionOf(TABLE, [aDocument('disposal_order'), plan]).parameters
          .landRight,
      ).toBe('LeaseOrUse');
    });

    // The case the wording would make one of 8.0.9.1.2 rests on an ownership
    // title, and an order is not one: the mismatch is named, not settled.
    it('is of the wrong class for 8.0.9.1.2 where a plan words ownership', () => {
      const answer = aPre2013Case(
        aDocument('disposal_order', { issue_date: '15.04.1999' }),
        aDocument('land_plot_plan', { right_type: 'Mülkiyyət hüququ' }),
      );

      expect(answer.parameters.landRight).toBe('LeaseOrUse');
      expect(answer.provisions.map(one => one.provision)).toEqual([
        '8.0.9.1.1',
      ]);
      expect(answer.titleDocuments[0]?.wrongClassFor).toEqual(['8.0.9.1.2']);
    });

    /*
     * The customer's two real submissions: an order beside a register extract
     * stating ownership. Two titles of two classes decide no right, so the case
     * is left between 8.0.9.1.1 and 8.0.9.1.2 for the inspector, and the order
     * is named as of the wrong class for 8.0.9.1.2. The extract is the
     * register's own record and is never held to a class.
     */
    it('leaves a case beside a register extract stating ownership to the inspector, and names the order as the mismatch', () => {
      const extract = aDocument('state_register_extract', {
        right_type: 'Mülkiyyət hüququ',
      });
      const answer = aPre2013Case(
        aDocument('disposal_order', { issue_date: '15.04.1999' }),
        extract,
      );

      expect(answer.parameters.landRight).toBeNull();
      expect(answer.decision.outcome).toBe('Ambiguous');
      expect(answer.provisions.map(one => one.provision)).toEqual([
        '8.0.9.1.1',
        '8.0.9.1.2',
      ]);
      expect(
        answer.titleDocuments.map(one => [one.documentType, one.wrongClassFor]),
      ).toEqual([
        ['disposal_order', ['8.0.9.1.2']],
        ['state_register_extract', []],
      ]);
    });

    it('names no class a title outside its window is of', () => {
      const answer = aPre2013Case(
        aDocument('disposal_order', { issue_date: '12.09.2011' }),
        aDocument('land_right_state_act', { issue_date: '1995' }),
      );

      expect(answer.titleDocuments[0]?.wrongClassFor).toEqual([]);
    });
  });

  // A technical passport drawn up in 2026 is no title under item 2.4, which
  // takes one drawn up before 2001; counting its kind would send an owned plot
  // to lease or use on a paper that founds nothing (ADR-0026).
  describe('a title outside every window it has', () => {
    it('does not decide the right', () => {
      const passport = aDocument('technical_passport', {
        issue_date: '17.04.2026',
      });
      const plan = aDocument('land_plot_plan', {
        right_type: 'Mülkiyyət hüququ',
      });

      expect(provisionOf(TABLE, [passport, plan]).parameters.landRight).toBe(
        'Ownership',
      );
    });
  });

  describe('what the provision asks for', () => {
    it('shows the requirements of the provision the case was decided under', () => {
      const answer = provisionOf(TABLE, [aDesign(), aPlan(), anActOf(2014)]);

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
      const acceptance = anActOf(2010);
      const design = aDocument('sketch_project', { building_height: '8 m' });
      const answer = provisionOf(TABLE, [lease, acceptance, design]);

      expect(answer.provisions.map(one => one.provision)).toEqual([
        '8.0.9.1.1',
      ]);
      expect(answer.provisions[0]?.requirements[0]?.answered).toBe(true);
    });

    // From 2026 the notification reaches the registry through the Urban
    // Planning Committee's system and not on paper.
    it('does not ask for the notification letter of a house built from 2026', () => {
      const answer = provisionOf(TABLE, [aDesign(), aPlan(), anActOf(2026)]);

      expect(answer.provisions[0]?.requirements[1]?.applies).toBe(false);
    });

    it('shows every candidate’s requirements where the case is ambiguous', () => {
      const answer = provisionOf(TABLE, [aPlan(), anActOf(2014)]);

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
      const answer = provisionOf(TABLE, [plan, design, anActOf(2010)]);

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
      const [standing] = provisionOf(TABLE, [decision]).titleDocuments;

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
        provisionOf(TABLE, [decision]).titleDocuments[0]?.withinWindow,
      ).toBe(false);
    });

    it('admits a paper any of whose items admits its date', () => {
      // Item 1.4 runs to 2006; item 2.2 closed in 1995.
      const decision = aDocument('land_allocation_decision', {
        issue_date: '03.03.1999',
      });
      const [standing] = provisionOf(TABLE, [decision]).titleDocuments;

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
      const [standing] = provisionOf(TABLE, [decision]).titleDocuments;

      expect(standing?.withinWindow).toBeNull();
      expect(standing?.dated).toBeNull();
    });

    it('lists no standing for a paper that is no title', () => {
      expect(provisionOf(TABLE, [aDesign()]).titleDocuments).toEqual([]);
    });
  });
});
