import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';

import {
  LoginRequestSchema,
  RegisterAccountRequestSchema,
  type AccountDto,
  type LoginRequest,
  type RegisterAccountRequest,
} from '@cadastre/api-contracts/accounts';

import { AccountsClientPort } from '../../../application/ports/index.js';
import {
  AllowsAnonymous,
  clearSessionCookie,
  CurrentAccount,
  SESSION_OPTIONS,
  SessionCodec,
  setSessionCookie,
  type SessionOptions,
} from '../../http/session/index.js';

/**
 * Signing in, signing out, and the four routes that may be reached without
 * already being signed in.
 *
 * The session is written here and nowhere else. The accounts context answers
 * who somebody is; how that answer travels from one request to the next — a
 * cookie, its flags, its lifetime — is transport, and transport is what this
 * package is (ADR-0029).
 */
@Controller('auth')
export class AuthController {
  constructor(
    @Inject(AccountsClientPort)
    private readonly accountsApi: AccountsClientPort,
    @Inject(SessionCodec) private readonly sessions: SessionCodec,
    @Inject(SESSION_OPTIONS) private readonly options: SessionOptions,
  ) {}

  /**
   * Opens an applicant's account. 201, and the account as it now stands.
   *
   * The identifier is a login and not an address, and the name arrives as two
   * fields — see `RegisterAccountRequestSchema`, which is where both decisions
   * are written down.
   *
   * It does not sign them in. Registering and signing in are two things a
   * person does, and a registration that quietly issued a session would make
   * the second one impossible to test and the first one impossible to do on
   * somebody else's behalf.
   */
  @Post('register')
  @AllowsAnonymous()
  async register(
    @Body({ schema: RegisterAccountRequestSchema })
    body: RegisterAccountRequest,
  ): Promise<AccountDto> {
    return this.accountsApi.accounts.register(body);
  }

  /**
   * 200 and the account, with the session set as a cookie.
   *
   * `passthrough: true` on the response, so the handler still returns its body
   * through Nest's own pipeline: without it, taking `@Res()` hands the whole
   * response over and the returned value is never sent.
   */
  @Post('login')
  @AllowsAnonymous()
  @HttpCode(HttpStatus.OK)
  async login(
    @Body({ schema: LoginRequestSchema }) body: LoginRequest,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AccountDto> {
    const account = await this.accountsApi.accounts.authenticate(body);
    const { token, maxAge } = this.sessions.issue(account.id);

    setSessionCookie(response, token, maxAge, this.options);

    return account;
  }

  /**
   * 204, and the cookie cleared — whether or not one arrived.
   *
   * Anonymous on purpose: signing out with an expired session is the ordinary
   * way a browser reaches this, and answering it 401 would leave the stale
   * cookie in place and the person on a screen with no way off it.
   *
   * What it cannot do is end a session anywhere but in this browser. The token
   * is signed rather than stored, so a copy taken off the wire goes on being
   * accepted until it expires; there is no list to remove it from
   * (TECH_DEBT §16).
   */
  @Post('logout')
  @AllowsAnonymous()
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) response: Response): void {
    clearSessionCookie(response, this.options);
  }

  /**
   * Who the session says this is. 401 with no session, which is the guard's
   * answer and not this handler's — the screen asks this first, and the 401 is
   * how it learns to show a sign-in form.
   */
  @Get('me')
  me(@CurrentAccount() account: AccountDto): AccountDto {
    return account;
  }
}
