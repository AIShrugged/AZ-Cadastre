/*
 * Which provision of Article 8 a first registration of an individual residential
 * house falls under, and what each provision asks the package for (ADR-0025).
 *
 * Transcribed from the customer's acceptance contract — "Reference
 * implementation: document compliance verification", version 1.2, blocks
 * `RULES`, `REQUIREMENTS` and `GROUND_ITEMS` — and not invented. The contract
 * states its own basis: Article 8 of the Law on the State Register of Immovable
 * Property (713-IIQ), Presidential Decree No. 439, and Articles 79–80 of the
 * Urban Planning and Construction Code. Where this table departs from the
 * contract, the departure is written beside the row it concerns and in
 * ADR-0025.
 *
 * It replaces `supporting-documents.table.ts`, whose thresholds and sets were
 * ours and were never confirmed (ADR-0013, TECH_DEBT §11).
 */

import type { ProvisionsDeclaration } from './provision.vo.js';

// The dates the Decree's windows turn on: the Law entering into force, and the
// dates the earlier regimes ended.
const LAW_IN_FORCE = '2006-07-06';
const BEFORE_2001 = '2001-01-01';

export const ARTICLE_8_PROVISIONS: ProvisionsDeclaration = {
  key: 'article_8_provisions',
  description:
    'Which provision of Article 8 a first state registration of an individual ' +
    'residential house falls under — decided on when it was built, its storeys, ' +
    'height and longest span, the right held over the land and what the land is ' +
    'designated for — and the papers that provision asks for.',
  // The papers that date a construction, in the order they are believed. Not
  // the design's approval date: a design approved in 2012 is a house built in
  // 2014 as often as not, and the regime turns on the building, not on the
  // drawing. Nothing else dates a case: the year the office declared at intake
  // decides nothing (ADR-0026).
  builtIn: [
    // The one line that states when the house was built, rather than when an
    // act about it was signed.
    ['technical_passport', 'built_year'],
    ['operation_acceptance_act', 'act_date'],
    ['operation_permit', 'permit_date'],
    ['construction_completion_notice', 'notice_date'],
  ],
  // The design is the only paper that describes the building rather than the
  // plot, and the sketch design is the one every provision's package carries.
  storeys: [
    ['sketch_project', 'storeys'],
    ['approved_design', 'storeys'],
  ],
  height: [
    ['sketch_project', 'building_height'],
    ['approved_design', 'building_height'],
  ],
  span: [
    ['sketch_project', 'span_dimensions'],
    ['approved_design', 'span_dimensions'],
  ],
  // "From the title document — the land plot category field of the extract.
  // Not taken from the sketch design." The plan-scheme prints the same category
  // and is the fallback where no extract is in the package.
  purpose: [
    ['state_register_extract', 'land_category'],
    ['land_plot_plan', 'land_category'],
  ],
  // Read only where no title document is in the package: the contract decides
  // the right by the kind of title, and the words are what is left without one.
  landRight: [
    ['state_register_extract', 'right_type'],
    ['land_plot_plan', 'right_type'],
  ],
  titleDocuments: [
    // Retrieved by the registry from MQS under Article 12.1 and not uploaded by
    // the applicant. Listed because an applicant who brings a printed extract
    // anyway has brought a title, and MQS is not connected to this system.
    {
      item: 'MQS',
      type: 'state_register_extract',
      landRight: 'Ownership',
      dateField: 'issue_date',
      issuedFrom: null,
      issuedBefore: null,
    },
    {
      item: '2.1',
      type: 'land_right_state_act',
      landRight: 'Ownership',
      dateField: 'issue_date',
      issuedFrom: null,
      issuedBefore: LAW_IN_FORCE,
    },
    {
      item: '8.0.5',
      type: 'registration_certificate',
      landRight: 'Ownership',
      dateField: 'issue_date',
      issuedFrom: null,
      issuedBefore: LAW_IN_FORCE,
    },
    {
      item: '8.0.5',
      type: 'property_right_certificate',
      landRight: 'Ownership',
      dateField: 'issue_date',
      issuedFrom: null,
      issuedBefore: LAW_IN_FORCE,
    },
    // Not in the contract's list. The same certificate is a ground under Article
    // 8.0.12 for the three years after the Law, and the statutory catalogue
    // already says so (ADR-0022); leaving the item out would turn every
    // certificate of 2007 into a title outside its window.
    {
      item: '8.0.12',
      type: 'property_right_certificate',
      landRight: 'Ownership',
      dateField: 'issue_date',
      issuedFrom: LAW_IN_FORCE,
      issuedBefore: '2009-06-24',
    },
    {
      item: '1.1',
      type: 'soviet_land_record',
      landRight: 'LeaseOrUse',
      dateField: 'issue_date',
      issuedFrom: null,
      issuedBefore: LAW_IN_FORCE,
    },
    {
      item: '1.4',
      type: 'land_allocation_decision',
      landRight: 'LeaseOrUse',
      dateField: 'issue_date',
      issuedFrom: null,
      issuedBefore: LAW_IN_FORCE,
    },
    {
      item: '2.2',
      type: 'land_allocation_decision',
      landRight: 'LeaseOrUse',
      dateField: 'issue_date',
      issuedFrom: '1991-11-09',
      issuedBefore: '1995-12-19',
    },
    {
      item: '1.6',
      type: 'notarised_land_allocation_contract',
      landRight: 'LeaseOrUse',
      dateField: 'issue_date',
      issuedFrom: '1948-08-26',
      issuedBefore: null,
    },
    {
      item: '2.3',
      type: 'household_book_extract',
      landRight: 'LeaseOrUse',
      dateField: 'issue_date',
      issuedFrom: null,
      issuedBefore: BEFORE_2001,
    },
    {
      item: '2.4',
      type: 'technical_passport',
      landRight: 'LeaseOrUse',
      dateField: 'issue_date',
      issuedFrom: null,
      issuedBefore: BEFORE_2001,
    },
    {
      item: '2.5',
      type: 'kolkhoz_allocation_decision',
      landRight: 'LeaseOrUse',
      dateField: 'issue_date',
      issuedFrom: null,
      issuedBefore: null,
    },
    {
      item: '2.5',
      type: 'bound_land_book_extract',
      landRight: 'LeaseOrUse',
      dateField: 'issue_date',
      issuedFrom: null,
      issuedBefore: null,
    },
    {
      item: '2.5-1',
      type: 'sovkhoz_allocation_order',
      landRight: 'LeaseOrUse',
      dateField: 'issue_date',
      issuedFrom: null,
      issuedBefore: null,
    },
    {
      item: '2.7',
      type: 'homestead_land_allocation_decision',
      landRight: 'LeaseOrUse',
      dateField: 'issue_date',
      issuedFrom: null,
      issuedBefore: BEFORE_2001,
    },
    {
      item: '2.8',
      type: 'apartment_demolition_decision',
      landRight: 'LeaseOrUse',
      dateField: 'issue_date',
      issuedFrom: null,
      issuedBefore: LAW_IN_FORCE,
    },
    {
      item: '8.0.1',
      type: 'state_property_disposal_act',
      landRight: 'LeaseOrUse',
      dateField: 'issue_date',
      issuedFrom: null,
      issuedBefore: null,
    },
    // Not in the contract's list under this name. The order of an executive
    // authority allotting the parcel is the paper both of the customer's real
    // submissions rest on. It is a title, and its kind confers no right: filed
    // as lease-or-use it sent both to 8.0.9.1.1, while their register extracts
    // say ownership. Which right it grants is read off the wording of the
    // extract or the plan (ADR-0026).
    {
      item: '8.0.1',
      type: 'disposal_order',
      landRight: null,
      dateField: 'issue_date',
      issuedFrom: null,
      issuedBefore: null,
    },
  ],
  rules: [
    {
      provision: '8.0.9.1.1',
      description:
        'Built before 2013, no taller than 12 m, on land held on lease or ' +
        'use: the title document with an approved design or an act of ' +
        'acceptance into operation.',
      builtBefore: 2013,
      heightAtMost: 12,
      landRights: ['LeaseOrUse'],
      titleRight: 'LeaseOrUse',
      requires: [{ anyOf: ['approved_design', 'operation_acceptance_act'] }],
    },
    {
      provision: '8.0.9.1.2',
      description:
        'Built before 2013, no taller than 12 m, on land held in ownership ' +
        'and designated for housing: the title document alone.',
      builtBefore: 2013,
      heightAtMost: 12,
      landRights: ['Ownership'],
      purposes: ['Residential'],
      titleRight: 'Ownership',
      requires: [],
    },
    {
      provision: '8.0.9.2',
      description:
        'Built before 2013 and taller than 12 m: the title document, the ' +
        'approved design, the decision permitting construction and the act of ' +
        'acceptance into operation.',
      builtBefore: 2013,
      heightAbove: 12,
      requires: [
        { anyOf: ['approved_design'] },
        { anyOf: ['construction_permit_decision'] },
        { anyOf: ['operation_acceptance_act'] },
      ],
    },
    {
      provision: '8.0.10.2',
      description:
        'Built from 2013 under the notification procedure — at most three ' +
        'storeys, 12 m and 6 m spans, on land designated for housing: the ' +
        'title document, the architectural and planning section, and the ' +
        'notification.',
      builtFrom: 2013,
      storeysAtMost: 3,
      heightAtMost: 12,
      spanAtMost: 6,
      purposes: ['Residential'],
      requires: [
        { anyOf: ['architectural_planning_section'] },
        // A letter to the authority up to 06.2025, and an entry in the Urban
        // Planning Committee's system after it (UPCC 80.6). The intake declares
        // a year and not a month, so 2025 is read on the letter's side.
        {
          anyOf: ['construction_completion_notice'],
          onlyBuiltBefore: 2026,
        },
      ],
    },
    // The fallback for everything built from 2013 that the notification
    // procedure does not cover — which is why the table is read first-hit.
    {
      provision: '8.0.10.1',
      description:
        'Built from 2013 outside the notification procedure: the title ' +
        'document, the construction permit, the architectural and planning ' +
        'section, and the permit for operation.',
      builtFrom: 2013,
      requires: [
        // The permit under the Code, not the decision of 8.0.9.2 — the
        // contract names them apart (`permit`, `permitDec`).
        { anyOf: ['construction_permit'] },
        { anyOf: ['architectural_planning_section'] },
        { anyOf: ['operation_permit'] },
      ],
    },
  ],
};
