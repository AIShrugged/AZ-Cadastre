import {
  NAME_MAX_LENGTH,
  NAME_MIN_LENGTH,
} from '@cadastre/api-contracts/accounts';

import { InvalidPersonNameException } from '../exceptions/index.js';

/**
 * What the person is called: a given name and a family name, asked for and kept
 * apart.
 *
 * Two fields and not one string, because a form asks for two and because the
 * office sorts and searches by the family name. What this context deliberately
 * does not do is join them: which order they go in, whether a patronymic sits
 * between them, and what a column too narrow for both should drop are display
 * decisions, and they belong where the display is.
 *
 * One value object holding both rather than two of the same class, so that the
 * rule about a name part is written once and an account carries one name.
 */
export class PersonName {
  private constructor(
    public readonly first: string,
    public readonly last: string,
  ) {}

  static create(first: string, last: string): PersonName {
    return new PersonName(part('first name', first), part('last name', last));
  }
}

function part(which: 'first name' | 'last name', raw: string): string {
  // Runs of whitespace folded to one space: the same name typed with a double
  // space is the same name.
  const trimmed = raw.trim().replace(/\s+/g, ' ');

  if (trimmed.length < NAME_MIN_LENGTH) {
    throw new InvalidPersonNameException(which, 'it is empty');
  }
  if (trimmed.length > NAME_MAX_LENGTH) {
    throw new InvalidPersonNameException(
      which,
      `longer than ${NAME_MAX_LENGTH} characters`,
    );
  }

  return trimmed;
}
