import { describe, expect, it } from 'vitest';

import { InvalidPackageStatusException } from '../exceptions/index.js';

import { PackageStatus } from './package-status.vo.js';

describe('PackageStatus', () => {
  it('accepts each place a package can sit in the pipeline', () => {
    expect(PackageStatus.of('Pending')).toBe(PackageStatus.PENDING);
    expect(PackageStatus.of('Processing')).toBe(PackageStatus.PROCESSING);
    expect(PackageStatus.of('Completed')).toBe(PackageStatus.COMPLETED);
    expect(PackageStatus.of('Failed')).toBe(PackageStatus.FAILED);
  });

  it('refuses a status the pipeline has no place for', () => {
    expect(() => PackageStatus.of('Cancelled')).toThrow(
      InvalidPackageStatusException,
    );
    expect(() => PackageStatus.of('')).toThrow(InvalidPackageStatusException);
  });

  it('refuses a status that only looks right', () => {
    expect(() => PackageStatus.of('pending')).toThrow(
      InvalidPackageStatusException,
    );
    expect(() => PackageStatus.of(' Pending ')).toThrow(
      InvalidPackageStatusException,
    );
  });

  it('says what it was handed when it refuses', () => {
    expect(() => PackageStatus.of('Cancelled')).toThrow(/"Cancelled"/);
  });

  it('lists every place a package can sit', () => {
    expect(PackageStatus.all.map(status => status.value)).toEqual([
      'Pending',
      'Processing',
      'Completed',
      'Failed',
    ]);
  });

  it('starts a package that has never run', () => {
    expect(PackageStatus.PENDING.canStart).toBe(true);
  });

  it('starts a failed package again, because every stage skips what it already did', () => {
    expect(PackageStatus.FAILED.canStart).toBe(true);
  });

  it('does not start a package that is already running', () => {
    expect(PackageStatus.PROCESSING.canStart).toBe(false);
  });

  it('does not start a package that is done', () => {
    expect(PackageStatus.COMPLETED.canStart).toBe(false);
  });

  it('is under way only while it is processing', () => {
    expect(PackageStatus.PROCESSING.isUnderWay).toBe(true);
    expect(PackageStatus.PENDING.isUnderWay).toBe(false);
    expect(PackageStatus.COMPLETED.isUnderWay).toBe(false);
    expect(PackageStatus.FAILED.isUnderWay).toBe(false);
  });

  it('has come to rest once it is completed or failed', () => {
    expect(PackageStatus.COMPLETED.isTerminal).toBe(true);
    expect(PackageStatus.FAILED.isTerminal).toBe(true);
  });

  it('has not come to rest while it is pending or processing', () => {
    expect(PackageStatus.PENDING.isTerminal).toBe(false);
    expect(PackageStatus.PROCESSING.isTerminal).toBe(false);
  });

  it('is equal to another status naming the same place', () => {
    expect(PackageStatus.PENDING.equals(PackageStatus.of('Pending'))).toBe(
      true,
    );
    expect(PackageStatus.PENDING.equals(PackageStatus.PROCESSING)).toBe(false);
  });
});
