import { InvalidPageRangeException } from '../exceptions/index.js';

import type { PageNumber } from './page-number.vo.js';

export class PageRange {
  private constructor(
    public readonly first: PageNumber,
    public readonly last: PageNumber,
  ) {}

  static of(first: PageNumber, last: PageNumber): PageRange {
    if (last.value < first.value) {
      throw new InvalidPageRangeException(first.value, last.value);
    }

    return new PageRange(first, last);
  }

  static single(page: PageNumber): PageRange {
    return new PageRange(page, page);
  }

  get count(): number {
    return this.last.value - this.first.value + 1;
  }

  get isSingleSheet(): boolean {
    return this.count === 1;
  }

  covers(page: PageNumber): boolean {
    return page.value >= this.first.value && page.value <= this.last.value;
  }

  follows(other: PageRange): boolean {
    return this.first.value === other.last.value + 1;
  }

  equals(other: PageRange): boolean {
    return this.first.equals(other.first) && this.last.equals(other.last);
  }
}
