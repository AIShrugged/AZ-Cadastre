import { InvalidFullNameException } from '../exceptions/index.js';

const MAX_LENGTH = 200;

/**
 * What the person calls themselves, kept as one string.
 *
 * Deliberately not split into a given name and a surname: the applications this
 * system reads are written in Azerbaijani, where the patronymic is a third part
 * and the order on a paper is not the order on a form. A name is what somebody
 * writes, and a system that takes it in three boxes has decided which three.
 */
export class FullName {
  private constructor(public readonly value: string) {}

  static create(raw: string): FullName {
    // Runs of whitespace folded to one space: the same name typed with a
    // double space is the same name.
    const trimmed = raw.trim().replace(/\s+/g, ' ');

    if (trimmed === '') throw new InvalidFullNameException('it is empty');
    if (trimmed.length > MAX_LENGTH) {
      throw new InvalidFullNameException(
        `longer than ${MAX_LENGTH} characters`,
      );
    }

    return new FullName(trimmed);
  }

  toString(): string {
    return this.value;
  }
}
