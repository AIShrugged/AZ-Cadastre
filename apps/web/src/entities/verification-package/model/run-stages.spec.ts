import { describe, expect, it } from 'vitest';

import { STAGES } from './pipeline';
import {
  currentPhase,
  isClassified,
  RUN_PHASES,
  runPhases,
  type StageStatus,
} from './run-stages';

/** Nine stages, all pending, with the named ones overridden. 1-based, the way
 *  the pipeline numbers them. */
const run = (at: Record<number, StageStatus>): StageStatus[] =>
  Array.from(
    { length: STAGES },
    (_, i) => at[i + 1] ?? ('pending' as StageStatus),
  );

const done = (upTo: number): StageStatus[] =>
  run(
    Object.fromEntries(Array.from({ length: upTo }, (_, i) => [i + 1, 'done'])),
  );

describe('runPhases', () => {
  it('gives the applicant four phases whatever the pipeline is long', () => {
    expect(runPhases(run({}))).toHaveLength(RUN_PHASES);
  });

  it('holds a phase open until every stage under it is done', () => {
    // Reading covers stages 1–4: three of them done is still reading.
    expect(runPhases(done(3))[0]).toBe('current');
    expect(runPhases(done(4))[0]).toBe('done');
  });

  it('leaves the phases after the one in hand untouched', () => {
    expect(runPhases(done(4))).toEqual([
      'done',
      'pending',
      'pending',
      'pending',
    ]);
  });

  it('reports the phase its stage is working in', () => {
    expect(runPhases(run({ 1: 'done', 2: 'done', 3: 'current' }))).toEqual([
      'current',
      'pending',
      'pending',
      'pending',
    ]);
    expect(
      runPhases(run({ 1: 'done', 2: 'done', 3: 'done', 4: 'done', 5: 'done' })),
    ).toEqual(['done', 'done', 'pending', 'pending']);
  });

  it('says a phase broke down wherever in it the break was', () => {
    // A run that lost the package fails on one stage; the phase holding it says
    // so, because the four cells are all this reader has.
    expect(runPhases(run({ 1: 'done', 2: 'error' }))[0]).toBe('error');
    expect(runPhases(run({ 6: 'error' }))[2]).toBe('error');
  });

  it('is all done when the run is', () => {
    expect(runPhases(done(STAGES))).toEqual(['done', 'done', 'done', 'done']);
  });
});

describe('currentPhase', () => {
  it('names the first phase that is not behind the run', () => {
    expect(currentPhase(['done', 'current', 'pending', 'pending'])).toBe(2);
    expect(currentPhase(['pending', 'pending', 'pending', 'pending'])).toBe(1);
  });

  /* A finished run is "4 of 4" and never "5 of 4": the caption prints this
     number over `RUN_PHASES`, and pointing past the end read as a phase the
     pipeline does not have. */
  it('stops at the last phase rather than past it', () => {
    expect(currentPhase(['done', 'done', 'done', 'done'])).toBe(RUN_PHASES);
  });

  it('points at the phase that broke down, not past it', () => {
    expect(currentPhase(['done', 'error', 'pending', 'pending'])).toBe(2);
  });
});

describe('isClassified', () => {
  /* The rule the applicant's cabinet hides its shortfall behind: before it,
     every required paper is "not in the package" because nothing has been
     placed, and the person who uploaded them reads that as an accusation
     (COMM-115). */
  it('is false until classification has been through the package', () => {
    expect(isClassified(run({}))).toBe(false);
    expect(isClassified(run({ 1: 'done', 2: 'done', 3: 'current' }))).toBe(
      false,
    );
  });

  it('is true once classification is done', () => {
    expect(isClassified(done(3))).toBe(true);
    expect(isClassified(done(STAGES))).toBe(true);
  });

  /* A run that lost the package will place nothing more, so what is not here
     by then is not coming, and the shortfall is as known as it will get. */
  it('counts a stage that broke down as through', () => {
    expect(isClassified(run({ 1: 'done', 2: 'done', 3: 'error' }))).toBe(true);
  });
});
