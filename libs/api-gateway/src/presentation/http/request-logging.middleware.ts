import { randomUUID } from 'node:crypto';

import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

import { Logger } from '@cadastre/logger';

/** What the caller may hand us to tie its own log to ours. */
const REQUEST_ID_HEADER = 'x-request-id';

/**
 * What an exception filter leaves behind for the line below to carry, so that
 * a refused request is one line with its reason on it rather than two lines
 * that have to be read together.
 */
export type Refusal = { code: string; reason: string };

/**
 * One line per request, written when the response has actually gone out.
 *
 * Middleware rather than an interceptor, because an interceptor only runs on
 * requests that matched a route: a URL nobody serves is answered 404 by Express
 * itself, and that is exactly the request whose absence from the log is
 * confusing. `finish` rather than the handler's return, because the status is
 * then the status the client was sent — including the one a filter substituted.
 */
@Injectable()
export class RequestLoggingMiddleware implements NestMiddleware {
  private readonly logger: Logger;

  constructor(@Inject(Logger) logger: Logger) {
    this.logger = logger.child({ scope: RequestLoggingMiddleware.name });
  }

  use(request: Request, response: Response, next: NextFunction): void {
    // Honoured rather than replaced when the caller sent one: the web client
    // and this log then name the same request.
    const requestId = headerOf(request, REQUEST_ID_HEADER) ?? randomUUID();
    response.setHeader(REQUEST_ID_HEADER, requestId);
    response.locals.requestId = requestId;

    const startedAt = Date.now();
    const route = `${request.method} ${request.originalUrl}`;

    // The body is deliberately absent: these requests carry names, addresses
    // and identity card numbers, and a log is not the place for them.
    this.logger.debug('Request received', {
      requestId,
      method: request.method,
      url: request.originalUrl,
      contentLength: headerOf(request, 'content-length'),
      contentType: headerOf(request, 'content-type'),
      userAgent: headerOf(request, 'user-agent'),
    });

    response.on('finish', () => {
      const refusal = response.locals.refusal as Refusal | undefined;
      const finished = {
        requestId,
        method: request.method,
        url: request.originalUrl,
        status: response.statusCode,
        ...refusal,
        durationMs: Date.now() - startedAt,
      };

      // A refusal the caller caused is not the service misbehaving, and a 500
      // is: they are read by different people, so they are not the same level.
      if (response.statusCode >= 500) {
        this.logger.error(`${route} failed`, finished);
      } else if (response.statusCode >= 400) {
        this.logger.warn(`${route} refused`, finished);
      } else {
        this.logger.log(`${route} ${response.statusCode}`, finished);
      }
    });

    next();
  }
}

function headerOf(request: Request, name: string): string | undefined {
  const value = request.headers[name];

  return Array.isArray(value) ? value[0] : value;
}
