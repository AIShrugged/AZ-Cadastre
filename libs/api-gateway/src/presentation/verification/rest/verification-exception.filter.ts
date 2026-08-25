import {
  Catch,
  HttpStatus,
  Inject,
  type ArgumentsHost,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import type { ErrorBody } from '@cadastre/api-contracts/shared';
import { Logger } from '@cadastre/logger';
import {
  ApplicationException,
  DomainException,
  InfrastructureException,
} from '@cadastre/shared';

const DOMAIN_STATUS: Readonly<Record<string, number>> = {
  DOCUMENT_NOT_IN_PACKAGE: HttpStatus.NOT_FOUND,
  SOURCE_FILE_NOT_IN_PACKAGE: HttpStatus.NOT_FOUND,
  PAGE_NOT_IN_SOURCE_FILE: HttpStatus.NOT_FOUND,

  FILE_TOO_LARGE: HttpStatus.PAYLOAD_TOO_LARGE,

  DOCUMENT_ALREADY_CLASSIFIED: HttpStatus.CONFLICT,
  SOURCE_FILE_ALREADY_SPLIT: HttpStatus.CONFLICT,
  SOURCE_FILE_ALREADY_SEGMENTED: HttpStatus.CONFLICT,
  SOURCE_FILE_NOT_SPLIT: HttpStatus.CONFLICT,
  PAGE_ALREADY_RECOGNISED: HttpStatus.CONFLICT,
  PACKAGE_NOT_STARTABLE: HttpStatus.CONFLICT,
  PACKAGE_NOT_UNDER_WAY: HttpStatus.CONFLICT,
  PACKAGE_ALREADY_FINISHED: HttpStatus.CONFLICT,
  DOCUMENT_NOT_CLASSIFIED: HttpStatus.CONFLICT,
  UNCLASSIFIABLE_DOCUMENT: HttpStatus.CONFLICT,
};

const DOMAIN_DEFAULT_STATUS = HttpStatus.UNPROCESSABLE_ENTITY;

@Catch(DomainException, ApplicationException, InfrastructureException)
export class VerificationExceptionFilter implements ExceptionFilter {
  private readonly logger: Logger;

  constructor(@Inject(Logger) logger: Logger) {
    this.logger = logger.child({ scope: VerificationExceptionFilter.name });
  }

  catch(
    exception: DomainException | ApplicationException | InfrastructureException,
    host: ArgumentsHost,
  ): void {
    const status = this.statusOf(exception);
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();

    const context = {
      code: exception.code,
      status,
      method: request.method,
      url: request.originalUrl,
      requestId: response.getHeader('x-request-id'),
    };

    // A domain refusal is the system working — the inspector asked for
    // something the model does not allow — and it is logged as what the
    // request was answered with, not as a fault. An infrastructure failure is
    // a fault, and it is the one that needs its stack.
    if (exception instanceof InfrastructureException) {
      this.logger.error(exception.message, { ...context, error: exception });
    } else {
      this.logger.debug(exception.message, context);
    }

    const body: ErrorBody = {
      statusCode: status,
      code: exception.code,
      message: exception.message,
    };

    response.status(status).json(body);
  }

  private statusOf(
    exception: DomainException | ApplicationException | InfrastructureException,
  ): number {
    if (exception instanceof DomainException) {
      return DOMAIN_STATUS[exception.code] ?? DOMAIN_DEFAULT_STATUS;
    }

    return exception.status;
  }
}
