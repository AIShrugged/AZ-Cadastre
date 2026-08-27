import {
  Catch,
  HttpException,
  HttpStatus,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Response } from 'express';

import type { ErrorBody } from '@cadastre/api-contracts/shared';

const CODES: Readonly<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_FAILED',
  [HttpStatus.NOT_FOUND]: 'ROUTE_NOT_FOUND',
  [HttpStatus.METHOD_NOT_ALLOWED]: 'METHOD_NOT_ALLOWED',
};

/**
 * Refusals in the published error shape. The register answers a caller that
 * parses `ErrorBody`, so it must not invent a second shape for the one case
 * where it says no.
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost): void {
    const status = exception.getStatus();
    const payload = exception.getResponse();
    const message =
      typeof payload === 'string'
        ? payload
        : (messageIn(payload) ?? exception.message);

    const body: ErrorBody = {
      statusCode: status,
      code: CODES[status] ?? 'REQUEST_REFUSED',
      message,
    };

    host.switchToHttp().getResponse<Response>().status(status).json(body);
  }
}

function messageIn(payload: object): string | null {
  const message = (payload as { message?: unknown }).message;

  if (Array.isArray(message)) return message.map(String).join('; ');
  if (typeof message === 'string') return message;

  return null;
}
