import { describe, expect, it } from 'vitest';

import type {
  IssueDto,
  IssueKind,
  ReportDto,
} from '@cadastre/api-contracts/verification';

import {
  anyUnplaced,
  readReport,
  SUPPORTING_DOCUMENTS,
  supportingSetsOf,
} from './supporting-documents';

const issue = (kind: IssueKind, over: Partial<IssueDto> = {}): IssueDto => ({
  kind,
  message: 'audit line',
  documentId: null,
  sourceFileId: null,
  documentType: null,
  fieldName: null,
  checkKey: null,
  pageNumber: null,
  confidence: null,
  ...over,
});

const report = (issues: IssueDto[]): ReportDto => ({
  status: 'OK',
  generatedAt: '2026-09-09T00:00:00.000Z',
  issues,
});

/** A message that placed the case: filed against the reading it was decided on. */
const placed = issue(SUPPORTING_DOCUMENTS, {
  documentId: 'doc-1',
  sourceFileId: 'file-1',
  documentType: 'sketch_project',
  fieldName: 'building_height',
  pageNumber: 3,
  confidence: 0.94,
});

/** One that could not: no document, no sheet, no confidence. */
const unplaced = issue(SUPPORTING_DOCUMENTS);

describe('the sets a report states', () => {
  it('takes only the supporting-document lines, in the order stated', () => {
    const sets = supportingSetsOf(
      report([
        issue('MissingDocument', { documentType: 'passport' }),
        placed,
        issue('ExtraDocument'),
        unplaced,
      ]),
    );

    expect(sets.map(set => set.placed)).toEqual([true, false]);
  });

  // A package no run has reported on states nothing, which is not the same as
  // stating that no papers are needed.
  it('states nothing for a package with no report', () => {
    expect(supportingSetsOf(null)).toEqual([]);
  });

  // The contract's own marker (ADR-0013 §6). A message anchored to a sheet but
  // missing its confidence still placed the case, and reading the distinction
  // off the confidence alone would call it undecided.
  it('reads a message anchored to a sheet as placed, confidence or not', () => {
    const anchored = issue(SUPPORTING_DOCUMENTS, {
      documentId: 'doc-1',
      pageNumber: 2,
    });

    expect(supportingSetsOf(report([anchored]))[0]?.placed).toBe(true);
  });

  it('reads a message carrying no reading at all as unplaced', () => {
    expect(supportingSetsOf(report([unplaced]))[0]?.placed).toBe(false);
    expect(anyUnplaced(supportingSetsOf(report([unplaced])))).toBe(true);
    expect(anyUnplaced(supportingSetsOf(report([placed])))).toBe(false);
  });
});

describe('the three readings of a report', () => {
  // The one this exists to prevent: "we could not work out which papers this
  // case needs" drawn the way "we checked and it is in order" is drawn.
  it('never reads an unplaced set as a clean package', () => {
    expect(readReport(0, supportingSetsOf(report([unplaced])))).toBe(
      'could_not_place',
    );
  });

  it('reads a placed set over a package with nothing against it as clean', () => {
    expect(readReport(0, supportingSetsOf(report([placed])))).toBe(
      'checked_clean',
    );
  });

  // And it is not a finding either: nothing is wrong with the submission.
  it('does not turn an unplaced set into a finding', () => {
    expect(readReport(0, supportingSetsOf(report([unplaced])))).not.toBe(
      'checked_findings',
    );
  });

  // Findings answer the conclusion line; the outstanding question states itself
  // in its own panel rather than competing for that line.
  it('lets the findings hold the conclusion when both are true', () => {
    expect(readReport(2, supportingSetsOf(report([unplaced])))).toBe(
      'checked_findings',
    );
  });

  it('reads a report with nothing at all as clean', () => {
    expect(readReport(0, [])).toBe('checked_clean');
  });
});
