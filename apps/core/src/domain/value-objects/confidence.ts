/** Confidence — a score constrained to the range 0–1. */
export class Confidence {
  private constructor(public readonly value: number) {}

  static of(value: number): Confidence {
    if (Number.isNaN(value) || value < 0 || value > 1) {
      throw new Error("Confidence must be in the range 0–1.");
    }
    return new Confidence(value);
  }

  equals(other: Confidence): boolean {
    return this.value === other.value;
  }
}
