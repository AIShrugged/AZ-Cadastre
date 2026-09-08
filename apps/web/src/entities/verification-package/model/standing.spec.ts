import { describe, expect, it } from 'vitest';

import {
  PackageStandingSchema,
  PackageStatusSchema,
} from '@cadastre/api-contracts/verification';

import {
  isRunning,
  STANDING_KEY,
  STANDING_NOTE,
  STANDING_TONE,
  takesFiles,
} from './standing';

const STANDINGS = PackageStandingSchema.options;
const STATUSES = PackageStatusSchema.options;

describe('the standing the inspector is shown', () => {
  // The contract may gain a standing; a client that silently drew nothing for
  // it would leave the one state written for a person blank on the screen.
  it.each(STANDINGS)('gives %s a tone, a word and a next move', standing => {
    expect(STANDING_TONE[standing]).toBeDefined();
    expect(STANDING_KEY[standing]).toBe(`standing.${standing}`);
    expect(STANDING_NOTE[standing]).toBe(`standing.note.${standing}`);
  });

  it('marks the run beating only while it is actually reading', () => {
    expect(isRunning('UnderVerification')).toBe(true);
    expect(STANDINGS.filter(isRunning)).toEqual(['UnderVerification']);
  });

  // A shortfall in the papers and a breakdown in our own machinery are not the
  // same news, and the register's tones are what say them apart.
  it('keeps a broken run and a short package in different tones', () => {
    expect(STANDING_TONE.Stalled).toBe('failed');
    expect(STANDING_TONE.ShortOfDocuments).toBe('incomplete');
    expect(STANDING_TONE.Cleared).toBe('ok');
  });

  // A submission held up by a signature is not one with something wrong in it.
  it('does not report an unsigned archive search as a finding', () => {
    expect(STANDING_TONE.AwaitingArchiveApproval).not.toBe('issues');
    expect(STANDING_TONE.AwaitingArchiveApproval).not.toBe('incomplete');
  });
});

describe('whether the package will take another file', () => {
  // Read off `PackageStatusTakingFilesSchema` rather than a list kept here, so
  // a state the contract starts or stops accepting moves the button with it.
  it('refuses only while a run is under way', () => {
    expect(takesFiles('Processing')).toBe(false);
    expect(STATUSES.filter(status => !takesFiles(status))).toEqual([
      'Processing',
    ]);
  });

  // The case the operation exists for: a package that had been reported on is
  // re-opened by the file, not closed to it (ADR-0013).
  it('takes files for a package that has already been reported on', () => {
    expect(takesFiles('Completed')).toBe(true);
    expect(takesFiles('Failed')).toBe(true);
  });
});
