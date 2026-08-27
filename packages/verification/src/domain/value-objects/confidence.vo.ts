import { InvalidConfidenceException } from '../exceptions/index.js';

export class Confidence {
  // Below this a reading goes to the inspector as a finding rather than as a
  // fact (PRD §4.6). The engine owns the threshold, not a profile.
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
