export class FailureReason {
  static readonly MAX_LENGTH = 1024;

  private constructor(public readonly value: string) {}

  static create(raw: string): FailureReason {
    const trimmed = raw.trim();

    if (trimmed.length === 0) return FailureReason.unknown();

    return new FailureReason(trimmed.slice(0, FailureReason.MAX_LENGTH));
  }

  static unknown(): FailureReason {
    return new FailureReason('unknown');
  }

  equals(other: FailureReason): boolean {
    return this.value === other.value;
  }
}
