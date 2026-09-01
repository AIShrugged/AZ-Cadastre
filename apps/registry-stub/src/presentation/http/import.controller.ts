import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

import {
  RegistryImportService,
  WorkbookUnreadableError,
  type RegistryImportReport,
} from '../../application/index.js';

/**
 * What multer hands over, and no more. Written out rather than taken from
 * `@types/multer`: that package's types are a global augmentation of the Express
 * namespace, and a name, a size and a buffer is the whole of what an upload is
 * here.
 */
type UploadedWorkbook = {
  readonly originalname: string;
  readonly size: number;
  readonly buffer: Buffer;
};

/**
 * A register file is thousands of rows and a few megabytes. The ceiling is here
 * rather than left off because the whole workbook is held in memory to be read,
 * and an endpoint with no limit is a way to take the register down without
 * credentials.
 */
const MAX_WORKBOOK_BYTES = 25 * 1024 * 1024;

const XLSX = '.xlsx';

/**
 * Loading records into the register, which is not something the register is
 * asked — it is something done to it.
 *
 * Deliberately not part of `@cadastre/api-contracts`: what the register promises
 * its callers is `ArchiveRegistryApi`, and no verification of a submission ever
 * loads a register file. Publishing this would put an operator's tool in the
 * language two systems agree on (ADR-0011).
 */
@Controller('import')
export class ImportController {
  constructor(
    @Inject(RegistryImportService)
    private readonly imports: RegistryImportService,
  ) {}

  /**
   * 200 and not 201: the answer is a report on what the register now holds — how
   * many objects went in, how many it refused and where each refusal is in the
   * file — and not a resource created at a URL the caller can go and read.
   *
   * A workbook that is partly wrong is still answered with the report. The one
   * published refusal shape, `ErrorBody`, carries a sentence; what an operator
   * needs is the table of sheet, row and column, and flattening that into a line
   * would tell them nothing they could fix.
   */
  @Post('records')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: MAX_WORKBOOK_BYTES } }),
  )
  async records(
    @UploadedFile() file?: UploadedWorkbook,
  ): Promise<RegistryImportReport> {
    if (!file) {
      throw new BadRequestException(
        'Upload the workbook as multipart/form-data under the field "file".',
      );
    }

    // The extension and not the media type: browsers, curl and the office tools
    // that produce these files disagree about what an .xlsx is called, and one
    // of the three sends `application/octet-stream`.
    if (!file.originalname.toLowerCase().endsWith(XLSX)) {
      throw new BadRequestException(
        `The register imports ${XLSX} workbooks; "${file.originalname}" is not one.`,
      );
    }

    try {
      return await this.imports.import(file.buffer);
    } catch (error) {
      // A file that is not a workbook is a bad request; a workbook whose rows
      // are wrong is a report, and never reaches here.
      if (error instanceof WorkbookUnreadableError) {
        throw new BadRequestException(error.message);
      }

      throw error;
    }
  }
}
