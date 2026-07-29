import { InvalidConfidenceException } from "../exceptions/index.js";

export class Confidence {
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
