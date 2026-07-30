import { InfrastructureException } from "@cadastre/kernel";

import type { StorageKey } from "../../domain/value-objects/index.js";

export class UnreadablePdfException extends InfrastructureException {
  override readonly code = "PDF_UNREADABLE";
  override readonly status = 422;

  constructor(
    public readonly key: StorageKey,
    cause: unknown,
  ) {
    super(`"${key.value}" could not be opened as a PDF: ${String(cause)}`, {
      cause,
    });
  }
}

export class EmptyPdfException extends InfrastructureException {
  override readonly code = "PDF_HAS_NO_PAGES";
  override readonly status = 422;

  constructor(public readonly key: StorageKey) {
    super(`"${key.value}" is a PDF with no pages at all`);
  }
}

export class PdfTooLongException extends InfrastructureException {
  override readonly code = "PDF_TOO_LONG";
  override readonly status = 413;

  constructor(
    public readonly key: StorageKey,
    public readonly pages: number,
    public readonly limit: number,
  ) {
    super(
      `"${key.value}" has ${pages} pages, more than the ${limit} this pipeline splits`,
    );
  }
}
