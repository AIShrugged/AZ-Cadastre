import { Confidence } from "../value-objects/confidence.js";
import { DocumentFormat } from "../value-objects/document-format.js";
import { DocumentType } from "../value-objects/document-type.js";
import { ExtractedField } from "../value-objects/extracted-field.js";
import { Page } from "../value-objects/page.js";

/**
 * Document — aggregate root.
 *
 * One uploaded file, treated as exactly one logical document. Owns its Pages,
 * its recognized Document Type (assigned exactly once by classification), and
 * its Extracted Fields. Belongs to a Verification Package, referenced by id.
 *
 * Plain class for now; intended to later extend NestJS CQRS `AggregateRoot`.
 */
export class Document {
  private _pages: Page[] = [];
  private _type?: DocumentType;
  private _extractedFields: ExtractedField[] = [];

  constructor(
    public readonly id: string,
    public readonly packageId: string,
    public readonly fileName: string,
    public readonly format: DocumentFormat,
  ) {}

  get pages(): readonly Page[] {
    return this._pages;
  }

  get type(): DocumentType | undefined {
    return this._type;
  }

  get extractedFields(): readonly ExtractedField[] {
    return this._extractedFields;
  }

  addPage(page: Page): void {
    if (this._pages.some((p) => p.number === page.number)) {
      throw new Error(`Page ${page.number} already exists on this Document.`);
    }
    this._pages.push(page);
  }

  /** Record an OCR result against an existing page. */
  recordOcr(pageNumber: number, text: string, confidence: Confidence): void {
    const index = this._pages.findIndex((p) => p.number === pageNumber);
    if (index === -1) {
      throw new Error(`Cannot record OCR for missing page ${pageNumber}.`);
    }
    this._pages[index] = this._pages[index]!.withOcr(text, confidence);
  }

  /** Assign the Document Type exactly once (Unknown included). */
  classify(type: DocumentType): void {
    if (this._type !== undefined) {
      throw new Error("Document Type has already been assigned.");
    }
    this._type = type;
  }

  /** Attach an Extracted Field — only after the Document has been classified. */
  extractField(field: ExtractedField): void {
    if (this._type === undefined) {
      throw new Error("Cannot extract fields before the Document is classified.");
    }
    this._extractedFields.push(field);
  }
}
