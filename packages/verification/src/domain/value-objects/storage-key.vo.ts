import { InvalidStorageKeyException } from '../exceptions/index.js';

export class StorageKey {
  static readonly MAX_LENGTH = 1024;

  private constructor(public readonly value: string) {}

  static create(raw: string): StorageKey {
    const trimmed = raw.trim();

    if (trimmed.length === 0) throw new InvalidStorageKeyException('empty');
    if (trimmed.length > StorageKey.MAX_LENGTH) {
      throw new InvalidStorageKeyException('too_long');
    }

    return new StorageKey(trimmed);
  }

  equals(other: StorageKey): boolean {
    return this.value === other.value;
  }
}
