import { InvalidConfidenceException } from '../exceptions/index.js';

export class Confidence {
  /*
   * Below this a reading goes to the inspector as a finding rather than as a
   * fact. The engine owns the threshold, not a profile.
   *
   * 0.80 because PRD §4.6 says so and the PM confirmed it: one threshold for
   * the whole product. The same figure decides both halves of the one question
   * — whether the report doubts a reading, and whether the operator is offered
   * the document to send in again because its scan was read badly. There is one
   * low confidence here, not one for the report and another for the offer, and
   * the case card's green band (`READING_BAND_FLOOR.sure` = 80) is this number
   * in the reader's unit rather than a second line beside it.
   */
  static readonly FLOOR = new Confidence(0.8);

  private constructor(public readonly value: number) {}

  static of(raw: number): Confidence {
    if (!Number.isFinite(raw) || raw < 0 || raw > 1) {
      throw new InvalidConfidenceException(raw);
    }

    return new Confidence(raw);
  }

  static none(): Confidence {
    return new Confidence(0);
  }

  meets(threshold: Confidence): boolean {
    return this.value >= threshold.value;
  }

  isBelow(threshold: Confidence): boolean {
    return !this.meets(threshold);
  }

  equals(other: Confidence): boolean {
    return this.value === other.value;
  }
}
