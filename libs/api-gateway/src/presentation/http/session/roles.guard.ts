import {
  ForbiddenException,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import type { AccountRole } from '@cadastre/api-contracts/accounts';

import { REQUIRED_ROLES } from './access.decorators.js';
import { accountOf } from './authenticated-request.js';

/**
 * Which of the two roles may call a route, where it is only one of them.
 *
 * A second guard rather than a branch inside `SessionGuard`, because they
 * answer two different questions and give two different answers: "who are you"
 * is a 401, and "not you" is a 403. Registered after it, so the account it
 * reads is already on the request.
 *
 * A route with no `@RequiresRole` is open to any role with a session — which is
 * what the table in ADR-0029 means by "yes" in both columns — and the routes
 * where an applicant is refused say so beside themselves.
 *
 * Note where 403 is deliberately NOT used: not for a submission somebody else
 * owns. That is a 404, because a 403 on a case that exists tells a stranger it
 * exists. 403 here is only ever about a route an applicant has no business
 * calling at all, which is not a secret — the office has an archive search and
 * an overview, and saying so reveals nothing about anybody's papers.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<readonly AccountRole[]>(
      REQUIRED_ROLES,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) return true;

    const account = accountOf(context.switchToHttp().getRequest<Request>());

    // No account on a route that names roles means `SessionGuard` let it
    // through, which only happens where somebody also marked it anonymous. That
    // is a contradiction in the route's own decorators, and the safe reading of
    // it is the narrower one.
    if (!account || !required.includes(account.role)) {
      throw new ForbiddenException('Not for this role');
    }

    return true;
  }
}
