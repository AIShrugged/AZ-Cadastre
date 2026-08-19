import { describe, expect, it } from 'vitest';

import {
  DocumentAlreadyClassifiedException,
  DocumentNotClassifiedException,
  UnclassifiableDocumentException,
} from '../exceptions/index.js';
import {
  Classification,
  Confidence,
  DocumentId,
  DocumentType,
  FieldKey,
  FieldValue,
  PageNumber,
  PageRange,
  SourceFileId,
} from '../value-objects/index.js';

import { Document } from './document.entity.js';
import { ExtractedField } from './extracted-field.entity.js';

let sequence = 0;

function anId(): string {
  sequence += 1;
  return `0190a1b2-c3d4-7e5f-8a9b-${sequence.toString(16).padStart(12, '0')}`;
}

function range(first: number, last: number): PageRange {
  return PageRange.of(PageNumber.of(first), PageNumber.of(last));
}

function aDocument(
  pages: PageRange = range(1, 1),
  sourceFileId = SourceFileId.of(anId()),
): Document {
  return Document.create(DocumentId.of(anId()), sourceFileId, pages);
}

function aClassification(type = 'passport'): Classification {
  return Classification.of(DocumentType.create(type), Confidence.of(0.87));
}

function aField(key: string): ExtractedField {
  return ExtractedField.of(
    FieldKey.create(key),
    FieldValue.create('AZE1234567'),
    Confidence.of(0.8),
    PageNumber.first(),
  );
}

describe('Document', () => {
  it('occupies the sheets of the file it was found in', () => {
    const document = aDocument(range(2, 4));

    expect(document.pages.first.value).toBe(2);
    expect(document.pages.last.value).toBe(4);
  });

  it('knows which file it came from', () => {
    const sourceFileId = SourceFileId.of(anId());
    const document = aDocument(range(1, 1), sourceFileId);

    expect(document.isFrom(sourceFileId)).toBe(true);
    expect(document.isFrom(SourceFileId.of(anId()))).toBe(false);
  });

  it('is unclassified and empty when it is first found', () => {
    const document = aDocument();

    expect(document.isClassified).toBe(false);
    expect(document.classification).toBeNull();
    expect(document.hasFields).toBe(false);
  });

  it('takes the type the classifier placed it under', () => {
    const document = aDocument().classifiedAs(aClassification('title_deed'));

    expect(document.isClassified).toBe(true);
    expect(document.classification?.type.value).toBe('title_deed');
  });

  it('refuses a second classification', () => {
    const document = aDocument().classifiedAs(aClassification());

    expect(() => document.classifiedAs(aClassification('application'))).toThrow(
      DocumentAlreadyClassifiedException,
    );
  });

  it('counts a document the classifier could not place as classified', () => {
    const document = aDocument().classifiedAs(
      Classification.unplaced(Confidence.of(0.3)),
    );

    expect(document.isClassified).toBe(true);
    expect(document.classification?.isPlaced).toBe(false);
  });

  it('holds the fields extracted from it', () => {
    const document = aDocument()
      .classifiedAs(aClassification())
      .withFields([aField('passport_no')]);

    expect(document.hasFields).toBe(true);
    expect(document.fields.map(field => field.key.value)).toEqual([
      'passport_no',
    ]);
  });

  it('refuses fields before it has been classified', () => {
    expect(() => aDocument().withFields([aField('passport_no')])).toThrow(
      DocumentNotClassifiedException,
    );
  });

  it('refuses fields on a document with no known type', () => {
    const document = aDocument().classifiedAs(
      Classification.unplaced(Confidence.of(0.3)),
    );

    expect(() => document.withFields([aField('passport_no')])).toThrow(
      UnclassifiableDocumentException,
    );
  });

  it('leaves the document it was taken from untouched', () => {
    const found = aDocument();
    found.classifiedAs(aClassification());

    expect(found.isClassified).toBe(false);
  });

  it("keeps the fields handed to it out of the caller's reach", () => {
    const fields = [aField('passport_no')];
    const document = aDocument()
      .classifiedAs(aClassification())
      .withFields(fields);

    fields.push(aField('expiry'));

    expect(document.fields).toHaveLength(1);
  });

  it('behaves the same restored as it does after being classified', () => {
    const built = aDocument(range(2, 3))
      .classifiedAs(aClassification())
      .withFields([aField('passport_no')]);

    const restored = Document.restore({
      id: built.id,
      sourceFileId: built.sourceFileId,
      pages: built.pages,
      classification: built.classification,
      fields: built.fields,
    });

    expect(restored.isClassified).toBe(true);
    expect(restored.hasFields).toBe(true);
    expect(restored.pages.equals(range(2, 3))).toBe(true);
    expect(() => restored.classifiedAs(aClassification('application'))).toThrow(
      DocumentAlreadyClassifiedException,
    );
  });
});
