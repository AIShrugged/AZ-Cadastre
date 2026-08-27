import { FieldKey } from './field.vo.js';

export class FieldSpec {
  private constructor(
    public readonly key: FieldKey,
    public readonly label: string,
  ) {}

  static of(key: string, label: string): FieldSpec {
    return new FieldSpec(FieldKey.create(key), label);
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
