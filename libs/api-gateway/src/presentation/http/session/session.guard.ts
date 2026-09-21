import {
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { AccountsClientPort } from '../../../application/ports/index.js';

import { ALLOWS_ANONYMOUS } from './access.decorators.js';
import { attachAccount } from './authenticated-request.js';
import { SessionCodec } from './session-codec.js';
import { sessionCookieOf } from './session-cookie.js';

/**
 * Everything under `/api` needs a session, and this is where that sentence is
 * true.
 *
 * Registered globally and denying by default: a controller added tomorrow is
 * behind a session because nobody did anything, and the way out is the
 * `@AllowsAnonymous()` decorator on the route — one word, next to the route,
 * visible in review. The other arrangement, a list of public paths kept
 * somewhere else, fails the other way: a route is open until somebody remembers
 * to close it, and nothing says so.
 *
 * The account is read from the accounts context on every request rather than
 * carried in the token. That is one primary-key lookup per call, and what it
 * buys is that an account whose role changed, or that was removed, stops being
 * what it was at once instead of when its session happens to expire.
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(SessionCodec) private readonly sessions: SessionCodec,
    @Inject(AccountsClientPort)
    private readonly accountsApi: AccountsClientPort,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const signedIn = await this.signedIn(context);

    /*
     * Read even on an anonymous route, and attached where it was valid: signing
     * out with a session in hand and signing out without one are the same call,
     * and the handler should be able to tell.
     */
    if (this.allowsAnonymous(context)) return true;

    if (!signedIn) throw new UnauthorizedException('No session');

    return true;
  }

  private allowsAnonymous(context: ExecutionContext): boolean {
    return (
      this.reflector.getAllAndOverride<boolean>(ALLOWS_ANONYMOUS, [
        context.getHandler(),
        context.getClass(),
      ]) ?? false
    );
  }

  private async signedIn(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const token = sessionCookieOf(request);

    if (!token) return false;

    const accountId = this.sessions.open(token);

    if (!accountId) return false;

    /*
     * A session naming an account that is no longer there is a session that
     * names nobody. Answered as "no session" rather than as a 404 or a 500: the
     * caller's cookie is stale, and what they have to do about it is sign in.
     */
    const account = await this.accountsApi.accounts.findOne(accountId);

    if (!account) return false;

    attachAccount(request, account);

    return true;
  }
}
