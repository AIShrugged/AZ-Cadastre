import { describe, expect, it } from 'vitest';

import type {
  DocumentDto,
  FieldDto,
  PackageDetailDto,
} from '@cadastre/api-contracts/verification';

import {
  addedNames,
  anyOverlong,
  correctionsOf,
  EDIT_FIELD_VALUE_MAX_LENGTH,
  isChanged,
  isStruck,
  unreadNames,
  whyNotCorrectable,
  withoutText,
  withText,
} from './corrections';

const field = (over: Partial<FieldDto> = {}): FieldDto => ({
  name: 'cadastral_number',
  value: '1-2-3',
  confidence: 0.61,
  pageNumber: 1,
  origin: 'ReadOnThisDocument',
  takenFrom: null,
  editedByAccountId: null,
  editedAt: null,
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

const pkg = (over: Partial<PackageDetailDto> = {}): PackageDetailDto =>
  ({ id: 'pkg-1', status: 'Completed', ...over }) as PackageDetailDto;

const FIELDS = [field({ name: 'cadastral_number', value: '1-2-3' })];

describe('what one save would carry', () => {
  it('sends nothing for a box opened and left alone', () => {
    const draft = withText({}, 'cadastral_number', '1-2-3');
    expect(isChanged(FIELDS, draft, 'cadastral_number')).toBe(false);
    expect(correctionsOf(FIELDS, draft)).toEqual([]);
  });

  // The operator's hands, not their meaning: a space typed at the end of a
  // cadastral number is not a correction, and the contract trims it anyway.
  it('sends nothing for a value that differs only in whitespace', () => {
    const draft = withText({}, 'cadastral_number', '  1-2-3 ');
    expect(correctionsOf(FIELDS, draft)).toEqual([]);
  });

  it('sends the corrected value, trimmed', () => {
    const draft = withText({}, 'cadastral_number', ' 4-5-6 ');
    expect(correctionsOf(FIELDS, draft)).toEqual([
      { name: 'cadastral_number', value: '4-5-6' },
    ]);
  });

  // An emptied box is the operator saying the paper does not carry the key at
  // all, which the contract takes as `null` and drops.
  it('sends null for a box the operator emptied', () => {
    const draft = withText({}, 'cadastral_number', '   ');
    expect(isStruck(draft, 'cadastral_number')).toBe(true);
    expect(correctionsOf(FIELDS, draft)).toEqual([
      { name: 'cadastral_number', value: null },
    ]);
  });

  // A key the engine never read has no row on the document, so its original is
  // nothing — and a box opened on it and left empty is still nothing.
  it('sends a value the engine never read, and nothing for an empty box', () => {
    const opened = withText({}, 'owner_name', '');
    expect(addedNames(FIELDS, opened)).toEqual(['owner_name']);
    expect(correctionsOf(FIELDS, opened)).toEqual([]);

    const typed = withText(opened, 'owner_name', 'Əliyev Elçin');
    expect(correctionsOf(FIELDS, typed)).toEqual([
      { name: 'owner_name', value: 'Əliyev Elçin' },
    ]);
  });

  it('forgets a row put back', () => {
    const draft = withText({}, 'cadastral_number', '4-5-6');
    expect(
      correctionsOf(FIELDS, withoutText(draft, 'cadastral_number')),
    ).toEqual([]);
  });

  it('refuses a value longer than the contract takes', () => {
    const draft = withText(
      {},
      'cadastral_number',
      'x'.repeat(EDIT_FIELD_VALUE_MAX_LENGTH + 1),
    );
    expect(anyOverlong(draft)).toBe(true);
    expect(anyOverlong(withText({}, 'cadastral_number', 'x'))).toBe(false);
  });
});

describe('what may be added', () => {
  const SCHEMA = ['cadastral_number', 'owner_name', 'property_address'];

  // Never a key of this client's own invention: one the profile does not
  // declare comes back `FIELD_NOT_IN_SCHEMA`, which an operator can do nothing
  // about.
  it('offers the profile keys nothing was read for, in the profile order', () => {
    expect(unreadNames(SCHEMA, FIELDS, {})).toEqual([
      'owner_name',
      'property_address',
    ]);
  });

  it('stops offering a key a box is already open on', () => {
    const draft = withText({}, 'owner_name', '');
    expect(unreadNames(SCHEMA, FIELDS, draft)).toEqual(['property_address']);
  });
});

describe('where no correction is offered', () => {
  it('takes one on a classified paper of a settled package', () => {
    expect(whyNotCorrectable(pkg(), doc())).toBeNull();
  });

  // The pipeline reads the files it started with; a correction mid-run would
  // reach no stage, and the service refuses it with PACKAGE_NOT_TAKING_FILES.
  // A package merely queued is not mid-run and takes one — which is the
  // contract's own answer (`PackageStatusTakingFilesSchema`) and not a list
  // kept here.
  it('offers none while a run is under way, and one on a package still queued', () => {
    expect(whyNotCorrectable(pkg({ status: 'Processing' }), doc())).toBe(
      'running',
    );
    expect(whyNotCorrectable(pkg({ status: 'Pending' }), doc())).toBeNull();
  });

  it('offers none on a scan that has been replaced', () => {
    const spent = doc({
      supersededById: 'doc-2',
      supersededAt: '2026-09-20T10:00:00.000Z',
    });
    expect(whyNotCorrectable(pkg(), spent)).toBe('superseded');
  });

  // No type means no field schema to correct against — and the two answers the
  // reader gives for that are one answer here.
  it('offers none on a paper with no type the profile knows', () => {
    expect(whyNotCorrectable(pkg(), doc({ type: null }))).toBe('unclassified');
    expect(whyNotCorrectable(pkg(), doc({ type: 'unknown' }))).toBe(
      'unclassified',
    );
    expect(whyNotCorrectable(pkg(), doc({ type: 'out_of_profile' }))).toBe(
      'unclassified',
    );
  });
});
