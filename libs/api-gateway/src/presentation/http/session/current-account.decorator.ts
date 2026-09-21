import {
  createParamDecorator,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import type { Request } from 'express';

import type { AccountDto } from '@cadastre/api-contracts/accounts';

import { accountOf } from './authenticated-request.js';

/**
 * Whoever the session named.
 *
 * Non-optional on purpose: a handler asks for this because what it does depends
 * on who is asking, and on such a route `SessionGuard` has already run. The
 * refusal below is for the one way that can be false — the decorator used on a
 * route somebody also marked `@AllowsAnonymous()` — and it is a 401 rather than
 * a crash, because that is the answer a caller with no session should get.
 */
export const CurrentAccount = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AccountDto => {
    const account = accountOf(context.switchToHttp().getRequest<Request>());

    if (!account) throw new UnauthorizedException('No session');

    return account;
  },
);
