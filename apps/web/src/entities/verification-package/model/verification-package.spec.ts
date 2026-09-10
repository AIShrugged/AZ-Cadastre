/**
 * The wire ⇄ view-model mapping, tested where it carries a judgement.
 *
 * Most of `toViewPackage` is renaming and needs no guard. What does need one is
 * what the register's row is now read by: the applicant and the address the
 * pipeline read off the package's own papers. The client used to drop them on
 * the floor, and a mapper that filled their gaps — with an empty string, with a
 * placeholder, with the profile key — would be inventing the one thing the row
 * exists to say.
 */
import { describe, expect, it } from 'vitest';

import {
  PackageDtoSchema,
  type PackageDto,
} from '@cadastre/api-contracts/verification';

import { packageRef, toViewPackage } from './verification-package';

const dto = (over: Partial<PackageDto> = {}): PackageDto =>
  PackageDtoSchema.parse({
    id: '11111111-2222-3333-4444-555555555555',
    status: 'Completed',
    standing: 'Cleared',
    profileKey: 'article8',
    declared: { legalBasis: null, builtYear: null },
    applicantName: null,
    propertyAddress: null,
    cadastralNumber: null,
    archiveOutcome: null,
    archiveSearchApproved: false,
    filesCount: 1,
    documentsCount: 2,
    classifiedCount: 2,
    unclassifiedCount: 0,
    extractedCount: 2,
    reportStatus: 'OK',
    issuesCount: 0,
    lowConfidenceCount: 0,
    createdAt: '2026-09-01T08:00:00.000Z',
    updatedAt: '2026-09-01T09:00:00.000Z',
    ...over,
  } satisfies PackageDto);

describe('what names the case', () => {
  it('carries the reading and the confidence it was made with', () => {
    const view = toViewPackage(
      dto({
        applicantName: { value: 'ELÇİN ƏLİYEV', confidence: 0.97 },
        propertyAddress: { value: 'Bakı, Nizami küç. 12', confidence: 0.62 },
      }),
    );
    expect(view.applicant).toEqual({ value: 'ELÇİN ƏLİYEV', confidence: 0.97 });
    expect(view.address).toEqual({
      value: 'Bakı, Nizami küç. 12',
      confidence: 0.62,
    });
  });

  // Null is "no document of this package states it yet" — the run has not
  // reached the paper, or read nothing off it. The row draws that as silence,
  // which it can only do if the mapper hands it the silence intact.
  it('passes a value nothing states through as nothing', () => {
    const view = toViewPackage(dto());
    expect(view.applicant).toBeNull();
    expect(view.address).toBeNull();
  });

  // Read off the papers and never typed at the counter: the contract keeps the
  // office's declaration in a field of its own precisely so the two are not
  // confused, and this mapping must not undo that.
  it('does not read either off what the office declared', () => {
    const view = toViewPackage(
      dto({ declared: { legalBasis: 'sale_contract', builtYear: 1998 } }),
    );
    expect(view.applicant).toBeNull();
    expect(view.address).toBeNull();
  });
});

describe('the reference an inspector cites', () => {
  it('is the first block of the id, with the whole of it still on the row', () => {
    const view = toViewPackage(dto());
    expect(packageRef(view.id)).toBe('11111111');
    expect(view.id).toBe('11111111-2222-3333-4444-555555555555');
  });
});
