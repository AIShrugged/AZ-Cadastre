import { Command } from '@nestjs/cqrs';

import type { AccountView } from '../../../read-models/index.js';

/**
 * Carried as plain strings, already validated at the edge, and turned into the
 * context's words by the handler. A command that held value objects would make
 * the caller construct them, which is the edge doing the context's work.
 *
 * `role` is on the command and not on any request body: the registration route
 * passes `'user'` and the seed passes what it is seeding, and those are the
 * only two callers there are.
 */
export class RegisterAccountCommand extends Command<AccountView> {
  constructor(
    public readonly login: string,
    public readonly password: string,
    public readonly firstName: string,
    public readonly lastName: string,
    public readonly role: string,
  ) {
    super();
  }
}
