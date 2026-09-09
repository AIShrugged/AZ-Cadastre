/**
 * How one match is read: which band a confidence falls in, and what the record
 * was silent about.
 *
 * The bands are checked **at their floors**, because a floor is where an
 * off-by-a-hair reading shows up and nowhere else — and against the contract's
 * own `MATCH_BAND_FLOOR`, so a screen that quietly grew a scale of its own
 * fails here rather than in front of an operator.
 *
 * Components are not rendered in this set (TECH_DEBT §3), so the rules live in
 * the model and are tested there.
 */
import { describe, expect, it } from 'vitest';

import {
  ArchiveMatchDtoSchema,
  bandOf,
  MATCH_BAND_FLOOR,
  type ArchiveMatchDto,
  type MatchedCriterionDto,
} from '@cadastre/api-contracts/registry';

import {
  BAND_KEY,
  BAND_STEPS,
  CRITERION_KEY,
  readCriteria,
  THRESHOLD_CHOICES,
} from './match';

const RECORD = {
  registerNo: '308011000692',
  inventoryNo: null,
  address: 'Hövsan qəs., Zərifə Əliyeva küç. 14',
  ownerName: 'Məmmədov Elçin Vaqif oğlu',
  cadastralNumber: null,
  plotArea: '600 m²',
  location: null,
  documents: [],
};

/** A match as the register sends one, parsed through the contract's schema. */
const match = (
  criteria: MatchedCriterionDto[],
  confidence: number,
): ArchiveMatchDto =>
  ArchiveMatchDtoSchema.parse({
    record: RECORD,
    source: { name: 'Hövsan:qəbul edilən', register: 'Hovsan' },
    confidence,
    criteria,
    disputed: false,
  });

describe('bands', () => {
  it('names every band the contract publishes', () => {
    // A band added to the contract and not to the dictionary would render as a
    // key on screen.
    for (const { band } of THRESHOLD_CHOICES) {
      expect(BAND_KEY[band]).toBeDefined();
      expect(BAND_STEPS[band]).toBeGreaterThan(0);
    }
  });

  it('offers the contract’s own four floors, surest first', () => {
    expect(THRESHOLD_CHOICES).toEqual([
      { band: 'High', floor: MATCH_BAND_FLOOR.High },
      { band: 'Probable', floor: MATCH_BAND_FLOOR.Probable },
      { band: 'Possible', floor: MATCH_BAND_FLOOR.Possible },
      { band: 'Weak', floor: MATCH_BAND_FLOOR.Weak },
    ]);
  });

  it('puts a confidence in the band whose floor it reaches', () => {
    // On the floor and just under it — the two readings a band is worth
    // testing at.
    expect(bandOf(MATCH_BAND_FLOOR.High)).toBe('High');
    expect(bandOf(MATCH_BAND_FLOOR.High - 0.001)).toBe('Probable');
    expect(bandOf(MATCH_BAND_FLOOR.Probable)).toBe('Probable');
    expect(bandOf(MATCH_BAND_FLOOR.Probable - 0.001)).toBe('Possible');
    expect(bandOf(MATCH_BAND_FLOOR.Possible)).toBe('Possible');
    expect(bandOf(MATCH_BAND_FLOOR.Possible - 0.001)).toBe('Weak');
    expect(bandOf(1)).toBe('High');
    expect(bandOf(0)).toBe('Weak');
  });

  it('draws a stronger band with more of the meter filled', () => {
    expect(BAND_STEPS.High).toBeGreaterThan(BAND_STEPS.Probable);
    expect(BAND_STEPS.Probable).toBeGreaterThan(BAND_STEPS.Possible);
    expect(BAND_STEPS.Possible).toBeGreaterThan(BAND_STEPS.Weak);
    // Weak is an answer the register offered, not the absence of one.
    expect(BAND_STEPS.Weak).toBeGreaterThan(0);
  });

  it('names every criterion the register can be searched by', () => {
    expect(CRITERION_KEY.address).toBeDefined();
    expect(CRITERION_KEY.ownerName).toBeDefined();
    expect(CRITERION_KEY.cadastralNumber).toBeDefined();
  });
});

describe('readCriteria', () => {
  it('keeps a silent criterion out of what was graded', () => {
    const read = readCriteria(
      match(
        [
          {
            criterion: 'address',
            submitted: 'Hövsan, Zərifə Əliyeva 14',
            recorded: 'Hövsan qəs., Zərifə Əliyeva küç. 14',
            confidence: 0.94,
          },
          {
            criterion: 'cadastralNumber',
            submitted: '3080110',
            // The office that kept this register never had the column.
            recorded: null,
            confidence: null,
          },
        ],
        0.94,
      ),
    );

    expect(read.answered.map(line => line.criterion)).toEqual(['address']);
    expect(read.silent.map(line => line.criterion)).toEqual([
      'cadastralNumber',
    ]);
  });

  it('does not read silence as a zero', () => {
    const read = readCriteria(
      match(
        [
          {
            criterion: 'ownerName',
            submitted: 'Məmmədov Elçin',
            recorded: null,
            confidence: null,
          },
        ],
        0.8,
      ),
    );

    // Nothing to grade, and not something graded at 0: a register that never
    // kept the column has not disagreed with anybody.
    expect(read.answered).toEqual([]);
    expect(read.silent).toHaveLength(1);
    expect(read.answered.some(line => line.confidence === 0)).toBe(false);
  });

  it('keeps a genuine zero among the graded', () => {
    // 0 is the engine saying the two strings are nothing alike, which is an
    // answer. Folding it in with silence would lose the difference the whole
    // split exists for.
    const read = readCriteria(
      match(
        [
          {
            criterion: 'ownerName',
            submitted: 'Məmmədov Elçin',
            recorded: 'Quliyeva Sevil',
            confidence: 0,
          },
        ],
        0,
      ),
    );

    expect(read.answered).toHaveLength(1);
    expect(read.silent).toEqual([]);
  });

  it('keeps the register’s own order', () => {
    const read = readCriteria(
      match(
        [
          {
            criterion: 'address',
            submitted: 'Hövsan',
            recorded: 'Hövsan qəs.',
            confidence: 0.7,
          },
          {
            criterion: 'ownerName',
            submitted: 'Məmmədov',
            recorded: 'Məmmədov Elçin Vaqif oğlu',
            confidence: 0.82,
          },
        ],
        0.76,
      ),
    );

    expect(read.answered.map(line => line.criterion)).toEqual([
      'address',
      'ownerName',
    ]);
  });
});
