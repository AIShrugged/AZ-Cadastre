import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';

import type { ErrorBody } from '@cadastre/api-contracts/shared';

import type { Refusal } from '../../http/index.js';

/**
 * The refusals the framework raises before a context is ever asked: a body the
 * published schema rejects, a route that does not exist, a method that is not
 * allowed.
 *
 * Without this they came out in Nest's own shape — `{ statusCode, message,
 * error }`, with `message` an array of complaints and no `code` at all — while
 * `VerificationExceptionFilter` rendered everything else as the contract's
 * `ErrorBody`. So the API had two error shapes, the published language had one,
 * and the web client's `apiFailure` (which parses with `ErrorBodySchema` and
 * answers `null` when it fails) quietly lost the reason for every refused body.
 *
 * `code` is the part a client is allowed to branch on, so it is derived from
 * the status and nothing else: stable under rewording, and never a message
 * written for a person.
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const status = exception.getStatus();
    const response = host.switchToHttp().getResponse<Response>();

    const body: ErrorBody = {
      statusCode: status,
      code: codeFor(status),
      message: messageOf(exception),
    };

    // Left for the access log rather than logged here: one refused request is
    // one line, and the line that says a request was refused is the one that
    // should say why (ADR-0008).
    response.locals.refusal = {
      code: body.code,
      reason: body.message,
    } satisfies Refusal;

    response.status(status).json(body);
  }
}

const CODES: Readonly<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_FAILED',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHORISED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'ROUTE_NOT_FOUND',
  [HttpStatus.METHOD_NOT_ALLOWED]: 'METHOD_NOT_ALLOWED',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'PAYLOAD_TOO_LARGE',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'UNSUPPORTED_MEDIA_TYPE',
};

function codeFor(status: number): string {
  return CODES[status] ?? 'REQUEST_REFUSED';
}

/**
 * Nest packs a validation failure's complaints into `message` as an array. The
 * contract says `message` is a string — it is for a person to read — so they
 * are joined rather than published as a shape of their own.
 */
function messageOf(exception: HttpException): string {
  const payload = exception.getResponse();

  if (typeof payload === 'string') return payload;

  const message = (payload as { message?: unknown }).message;

  if (Array.isArray(message)) return message.map(String).join('; ');
  if (typeof message === 'string') return message;

  return exception.message;
}
