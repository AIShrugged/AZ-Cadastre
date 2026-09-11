import { InvalidConfidenceException } from '../exceptions/index.js';

export class Confidence {
  /*
   * Below this a reading goes to the inspector as a finding rather than as a
   * fact (PRD §4.6). The engine owns the threshold, not a profile.
   *
   * Raised from 0.80 to 0.85 for COMM-80. The operator can now be offered a
   * document to send in again because the scan of it was read badly, and the
   * figure that decides "read badly" there is the same one that decides whether
   * a reading is doubted in the report — there is one low confidence in this
   * product, not one for the report and another for the offer. The cost is
   * accepted and is the point: more readings are doubted, and packages that
   * used to report clean now carry `LowConfidence` findings an inspector is
   * asked to look at.
   */
  static readonly FLOOR = new Confidence(0.85);

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
