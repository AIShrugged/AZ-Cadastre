import { randomUUID } from 'node:crypto';

import {
  Inject,
  Injectable,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { Logger } from '@cadastre/logger';

/** What the caller may hand us to tie its own log to ours. */
const REQUEST_ID_HEADER = 'x-request-id';

/**
 * One line per request, written when the response has actually gone out.
 *
 * It hangs on the response's `finish` event rather than on the observable the
 * handler returns, for two reasons: the status is then the status the client
 * was sent — including the one an exception filter substituted — and the edge
 * does not have to take a dependency on rxjs to time a request.
 *
 * A request that never matched a route is not seen here (Nest resolves those
 * before interceptors run); those are logged by `HttpExceptionFilter`, which
 * is where they end up.
 */
@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger: Logger;

  constructor(@Inject(Logger) logger: Logger) {
    this.logger = logger.child({ scope: RequestLoggingInterceptor.name });
  }

  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): ReturnType<CallHandler['handle']> {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();

    // Honoured rather than replaced when the caller sent one: the web client
    // and this log then name the same request.
    const requestId = headerOf(request, REQUEST_ID_HEADER) ?? randomUUID();
    response.setHeader(REQUEST_ID_HEADER, requestId);

    const startedAt = Date.now();
    const route = `${request.method} ${request.originalUrl}`;

    // The body is deliberately absent: these requests carry names, addresses
    // and identity card numbers, and a log is not the place for them.
    this.logger.debug('Request received', {
      requestId,
      method: request.method,
      url: request.originalUrl,
      handler: `${context.getClass().name}.${context.getHandler().name}`,
      contentLength: headerOf(request, 'content-length'),
      contentType: headerOf(request, 'content-type'),
      userAgent: headerOf(request, 'user-agent'),
    });

    response.on('finish', () => {
      const finished = {
        requestId,
        method: request.method,
        url: request.originalUrl,
        status: response.statusCode,
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

    return next.handle();
  }
}

function headerOf(request: Request, name: string): string | undefined {
  const value = request.headers[name];

  return Array.isArray(value) ? value[0] : value;
}
