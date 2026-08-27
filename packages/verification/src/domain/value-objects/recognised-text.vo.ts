export class RecognisedText {
  private constructor(public readonly value: string) {}

  static of(raw: string): RecognisedText {
    return new RecognisedText(raw);
  }

  static empty(): RecognisedText {
    return new RecognisedText('');
  }

  get isEmpty(): boolean {
    return this.value.trim().length === 0;
  }

  concat(other: RecognisedText): RecognisedText {
    if (this.isEmpty) return other;
    if (other.isEmpty) return this;

    return new RecognisedText(`${this.value}\n${other.value}`);
  }

  equals(other: RecognisedText): boolean {
    return this.value === other.value;
  }
}
