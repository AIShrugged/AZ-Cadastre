import { describe, expect, it } from 'vitest';

import { looksLike } from '../services/document-hints.service.js';

import { DocumentCatalogue } from './document-catalogue.vo.js';
import { DocumentType } from './document-type.vo.js';
import { VerificationProfile } from './verification-profile.vo.js';

const CATALOGUE = DocumentCatalogue.KNOWN;

describe('DocumentCatalogue', () => {
  it('names the papers the envelopes are known to carry beside the profile', () => {
    const keys = CATALOGUE.types.map(type => type.value);

    expect(keys).toContain('courier_waybill');
    expect(keys).toContain('registrar_routing_sheet');
    expect(keys).toContain('covering_letter');
  });

  // The list stopped being "what the envelopes have been seen to carry" and
  // became the statutory one (ADR-0022): Article 8 of the Law, the Decree
  // No. 439 list it refers to, the papers of the application, and the
  // registry's own service sheets.
  it('covers the grounds Article 8 lists, not only the service sheets', () => {
    const keys = CATALOGUE.types.map(type => type.value);

    expect(keys).toContain('auction_results_protocol');
    expect(keys).toContain('inheritance_certificate');
    expect(keys).toContain('court_decision');
    expect(keys).toContain('operation_acceptance_act');
    expect(keys).toContain('state_housing_allocation_order');
  });

  it('covers the grounds the Decree No. 439 list names', () => {
    const keys = CATALOGUE.types.map(type => type.value);

    expect(keys).toContain('soviet_land_record');
    expect(keys).toContain('land_right_state_act');
    expect(keys).toContain('household_book_extract');
    expect(keys).toContain('kolkhoz_allocation_decision');
    expect(keys).toContain('apartment_demolition_decision');
  });

  it('covers the papers of the application the profile does not ask for', () => {
    const keys = CATALOGUE.types.map(type => type.value);

    expect(keys).toContain('power_of_attorney');
    expect(keys).toContain('technical_passport');
    expect(keys).toContain('state_register_extract');
  });

  it('holds every entry in exactly one group, and every group holds some', () => {
    const grouped = CATALOGUE.groups.flatMap(group => group.entries);

    expect(grouped).toEqual([...CATALOGUE.entries]);
    for (const group of CATALOGUE.groups) {
      expect(group.entries.length).toBeGreaterThan(0);
      expect(group.title.length).toBeGreaterThan(0);
    }
  });

  it('names each group once', () => {
    const keys = CATALOGUE.groups.map(group => group.key);

    expect(new Set(keys).size).toBe(keys.length);
  });

  it('holds a real document type for every entry, never one of the two the engine keeps for itself', () => {
    for (const type of CATALOGUE.types) {
      expect(type.isKnown).toBe(true);
    }
  });

  it('names each paper once, so a heading cannot resolve to two entries', () => {
    const keys = CATALOGUE.types.map(type => type.value);

    expect(new Set(keys).size).toBe(keys.length);
  });

  // A catalogue key that is also a profile key would make the same document
  // both an answer to a requirement and an extra document, depending only on
  // which list was consulted first.
  it('never claims a key the cadastre profile already asks for', () => {
    const profile = VerificationProfile.CADASTRE.documentTypes.map(
      type => type.value,
    );

    for (const type of CATALOGUE.types) {
      expect(profile).not.toContain(type.value);
    }
  });

  it('tells whoever classifies what each entry is and what it is headed', () => {
    for (const entry of CATALOGUE.entries) {
      expect(entry.description.length).toBeGreaterThan(0);
      expect(entry.hints.length).toBeGreaterThan(0);
    }
  });

  // It exists to be named, not to be filled in: nothing is extracted from it
  // and nothing counts it as missing.
  it('asks for no fields and is required of nothing', () => {
    for (const entry of CATALOGUE.entries) {
      expect(entry.schema.isEmpty).toBe(true);
      expect(entry.isRequired).toBe(false);
    }
  });

  // Every heading is a needle the offline reader searches the sheet with, and
  // a heading that resolves to a NEIGHBOUR's entry is worse than no heading at
  // all: it names the paper wrongly and does so confidently. With six entries
  // this could be seen by eye; with fifty it is asserted.
  it('gives no entry a heading that reads as another entry', () => {
    for (const entry of CATALOGUE.entries) {
      for (const hint of entry.hints) {
        expect(looksLike(hint, CATALOGUE.entries)?.type.value).toBe(
          entry.type.value,
        );
      }
    }
  });

  it('spells every key in snake_case, so a key is never a sentence', () => {
    for (const type of CATALOGUE.types) {
      expect(type.value).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/);
    }
  });

  // The dates of the Decree No. 439 list are a feature of the paper and never a
  // rule: the classifier is not asked to reject a document for being dated
  // outside a window, and nothing here gives it a window to reject one by.
  it('keeps a date constraint in the prose of an entry and nowhere else', () => {
    const entry = CATALOGUE.entryFor(
      DocumentType.create('household_book_extract'),
    );

    expect(entry?.description).toContain('1 January 2001');
    expect(entry?.schema.isEmpty).toBe(true);
  });

  it('recognises a key it holds', () => {
    expect(CATALOGUE.recognises(DocumentType.create('courier_waybill'))).toBe(
      true,
    );
  });

  it('does not recognise a key it does not hold', () => {
    expect(CATALOGUE.recognises(DocumentType.create('identity_card'))).toBe(
      false,
    );
    expect(CATALOGUE.recognises(DocumentType.OUT_OF_PROFILE)).toBe(false);
    expect(CATALOGUE.recognises(DocumentType.UNKNOWN)).toBe(false);
  });

  it('hands back the entry behind a key it holds, and nothing for one it does not', () => {
    const entry = CATALOGUE.entryFor(DocumentType.create('covering_letter'));

    expect(entry?.type.value).toBe('covering_letter');
    expect(CATALOGUE.entryFor(DocumentType.create('passport'))).toBeNull();
  });
});
