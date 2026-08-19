import { describe, expect, it } from 'vitest';

import { PackageId } from '../../domain/value-objects/index.js';

import { isStoredId } from './stored-id.js';

describe('isStoredId', () => {
  it('accepts a UUID, the shape every id column in this schema declares', () => {
    expect(
      isStoredId(PackageId.of('0190a1b2-c3d4-7e5f-8a9b-000000000001')),
    ).toBe(true);
  });

  it('accepts a UUID in either case, because PostgreSQL does', () => {
    expect(
      isStoredId(PackageId.of('0190A1B2-C3D4-7E5F-8A9B-000000000001')),
    ).toBe(true);
  });

  it('refuses a string that is not a UUID at all', () => {
    expect(isStoredId(PackageId.of('not-a-uuid'))).toBe(false);
  });

  it('refuses the empty id an EntityId will happily hold', () => {
    expect(isStoredId(PackageId.of(''))).toBe(false);
  });

  it('refuses a UUID with anything appended, so a crafted id cannot slip past', () => {
    expect(
      isStoredId(PackageId.of('0190a1b2-c3d4-7e5f-8a9b-000000000001 or 1=1')),
    ).toBe(false);
  });

  it('refuses a UUID missing a group', () => {
    expect(isStoredId(PackageId.of('0190a1b2-c3d4-7e5f-8a9b'))).toBe(false);
  });
});
