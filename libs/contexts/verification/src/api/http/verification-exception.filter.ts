import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
  Logger,
} from "@nestjs/common";
import {
  ApplicationException,
  DomainException,
  InfrastructureException,
} from "@cadastre/kernel";
import type { ErrorBody } from "@cadastre/contracts";
import type { Response } from "express";

const DOMAIN_STATUS: Readonly<Record<string, number>> = {
  DOCUMENT_NOT_IN_PACKAGE: HttpStatus.NOT_FOUND,
  SOURCE_FILE_NOT_IN_PACKAGE: HttpStatus.NOT_FOUND,
  PAGE_NOT_IN_SOURCE_FILE: HttpStatus.NOT_FOUND,

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
  private readonly logger = new Logger(VerificationExceptionFilter.name);

  catch(
    exception: DomainException | ApplicationException | InfrastructureException,
    host: ArgumentsHost,
  ): void {
    const status = this.statusOf(exception);
    const response = host.switchToHttp().getResponse<Response>();

    if (exception instanceof InfrastructureException) {
      this.logger.error(`${exception.code}: ${exception.message}`, exception.stack);
    } else {
      this.logger.debug(`${exception.code}: ${exception.message}`);
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
