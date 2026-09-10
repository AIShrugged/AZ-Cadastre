import { FieldKey } from './field.vo.js';

export class FieldSpec {
  private constructor(
    public readonly key: FieldKey,
    public readonly label: string,
    // What the reader has to be told about this field beyond its label, or
    // null. A label names the value; a note says which of two values printed
    // side by side is meant, or where on the sheet it is written down — "the
    // area the document states, not the surveyed one", "counted off the floor
    // plans". Declared per document type and not per key: the same key can be
    // read differently off two papers, and the sentence belongs to the pairing
    // rather than to the word.
    public readonly note: string | null,
  ) {}

  static of(key: string, label: string, note: string | null = null): FieldSpec {
    return new FieldSpec(FieldKey.create(key), label, note);
  }
}

export class FieldSchema {
  private constructor(public readonly specs: readonly FieldSpec[]) {}

  static of(specs: readonly FieldSpec[]): FieldSchema {
    return new FieldSchema([...specs]);
  }

  static none(): FieldSchema {
    return new FieldSchema([]);
  }

  get isEmpty(): boolean {
    return this.specs.length === 0;
  }

  declares(key: FieldKey): boolean {
    return this.specs.some(spec => spec.key.equals(key));
  }
}
