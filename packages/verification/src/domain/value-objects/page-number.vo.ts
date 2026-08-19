import { InvalidPageNumberException } from '../exceptions/index.js';

export class PageNumber {
  private constructor(public readonly value: number) {}

  static of(raw: number): PageNumber {
    if (!Number.isInteger(raw) || raw < 1) {
      throw new InvalidPageNumberException(raw);
    }

    return new PageNumber(raw);
  }

  static first(): PageNumber {
    return new PageNumber(1);
  }

  next(): PageNumber {
    return new PageNumber(this.value + 1);
  }

  equals(other: PageNumber): boolean {
    return this.value === other.value;
  }
}
