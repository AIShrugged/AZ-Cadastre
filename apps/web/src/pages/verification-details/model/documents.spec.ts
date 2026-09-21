import { describe, expect, it } from 'vitest';

import type {
  DocumentDto,
  FieldDto,
} from '@cadastre/api-contracts/verification';

import { documentWeight, isAside, needsReview } from './documents';

const field = (over: Partial<FieldDto> = {}): FieldDto => ({
  name: 'cadastral_number',
  value: '1-2-3',
  confidence: 0.97,
  pageNumber: 1,
  origin: 'ReadOnThisDocument',
  takenFrom: null,
  ...over,
});

const doc = (over: Partial<DocumentDto> = {}): DocumentDto =>
  ({
    id: 'doc-1',
    firstPage: 1,
    lastPage: 1,
    type: 'technical_passport',
    classificationConfidence: 0.99,
    attestation: null,
    fields: [field()],
    archiveQrCheck: null,
    supersededById: null,
    supersededAt: null,
    ...over,
  }) as DocumentDto;

const REQUIRED = ['land_right_state_act', 'technical_passport'];

describe('documentWeight', () => {
  it('prints a paper the profile requires at full weight', () => {
    expect(documentWeight(doc({ type: 'technical_passport' }), REQUIRED)).toBe(
      'primary',
    );
  });

  it('prints a paper carrying a doubtful reading at full weight, required or not', () => {
    const doubted = doc({
      type: 'utility_bill',
      fields: [field({ confidence: 0.4 })],
    });

    expect(REQUIRED).not.toContain('utility_bill');
    expect(documentWeight(doubted, REQUIRED)).toBe('primary');
  });

  it('prints a paper the profile merely recognises at standard weight', () => {
    expect(documentWeight(doc({ type: 'utility_bill' }), REQUIRED)).toBe(
      'standard',
    );
  });

  it('quiets a paper the statutory list does not name', () => {
    expect(documentWeight(doc({ type: 'out_of_profile' }), REQUIRED)).toBe(
      'quiet',
    );
  });

  // A spent scan can be of a required type and can carry a doubtful reading;
  // it is still the paper the case no longer rests on (COMM-80).
  it('quiets a scan a later arrival pushed out of force', () => {
    const spent = doc({
      type: 'technical_passport',
      fields: [field({ confidence: 0.2 })],
      supersededAt: '2026-02-03T10:00:00Z',
      supersededById: 'doc-2',
    });

    expect(documentWeight(spent, REQUIRED)).toBe('quiet');
  });

  it('prints an unplaceable paper at full weight — it is work', () => {
    expect(documentWeight(doc({ type: null }), REQUIRED)).toBe('primary');
    expect(documentWeight(doc({ type: 'unknown' }), REQUIRED)).toBe('primary');
  });

  // The profile is the engine's list and never one kept on this screen: with
  // no profile loaded the register states no hierarchy rather than the wrong
  // one.
  it('claims no requirement while the profile has not loaded', () => {
    expect(documentWeight(doc({ type: 'technical_passport' }), [])).toBe(
      'standard',
    );
  });
});

describe('needsReview', () => {
  it('is silent about a value carried over from another paper', () => {
    const carried = doc({
      fields: [
        field({
          confidence: 0.3,
          origin: 'TakenFromAnotherDocument',
          pageNumber: null,
        }),
      ],
    });

    expect(needsReview(carried)).toBe(false);
  });

  it('answers to a placement the classifier was unsure of', () => {
    expect(needsReview(doc({ classificationConfidence: 0.5 }))).toBe(true);
  });
});

describe('isAside', () => {
  it('names only the papers placed outside the profile', () => {
    expect(isAside(doc({ type: 'out_of_profile' }))).toBe(true);
    expect(isAside(doc({ type: 'unknown' }))).toBe(false);
  });
});
