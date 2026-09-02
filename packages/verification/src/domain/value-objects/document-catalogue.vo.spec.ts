import { describe, expect, it } from 'vitest';

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
