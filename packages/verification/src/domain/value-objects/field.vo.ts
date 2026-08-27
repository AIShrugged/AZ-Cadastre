import {
  InvalidFieldKeyException,
  InvalidFieldValueException,
} from '../exceptions/index.js';

export class FieldKey {
  static readonly MAX_LENGTH = 64;

  private constructor(public readonly value: string) {}

  static create(raw: string): FieldKey {
    const trimmed = raw.trim();

    if (trimmed.length === 0) throw new InvalidFieldKeyException('empty');
    if (trimmed.length > FieldKey.MAX_LENGTH) {
      throw new InvalidFieldKeyException('too_long');
    }

    return new FieldKey(trimmed);
  }

  equals(other: FieldKey): boolean {
    return this.value === other.value;
  }
}

export class FieldValue {
  static readonly MAX_LENGTH = 4096;

  private constructor(public readonly value: string) {}

  static create(raw: string): FieldValue {
    const trimmed = raw.trim();

    if (trimmed.length === 0) throw new InvalidFieldValueException('empty');
    if (trimmed.length > FieldValue.MAX_LENGTH) {
      throw new InvalidFieldValueException('too_long');
    }

    return new FieldValue(trimmed);
  }

  equals(other: FieldValue): boolean {
    return this.value === other.value;
  }
}
