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
  EditorAccountId,
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

  /*
   * A person correcting a value and the machine putting its own back on the
   * next run is the one failure that would make the whole correction feature
   * worthless, so the rule lives on the only way a reading reaches a document
   * (ADR-0033).
   */
  describe("carrying an operator's corrections", () => {
    const OPERATOR = EditorAccountId.of('0190a1b2-c3d4-7e5f-8a9b-0000000000aa');
    const AT = new Date('2026-09-21T10:00:00.000Z');

    const edit = (key: string, value: string | null) => ({
      key: FieldKey.create(key),
      value: value === null ? null : FieldValue.create(value),
    });

    function corrected(): Document {
      return aDocument()
        .classifiedAs(aClassification())
        .withFields([aField('document_no')])
        .withEdits([edit('document_no', 'AZE7654321')], OPERATOR, AT);
    }

    it('replaces the reading with what the operator typed', () => {
      const field = corrected().fields[0];

      expect(field?.value.value).toBe('AZE7654321');
      expect(field?.wasEnteredByOperator).toBe(true);
      expect(field?.editedBy?.equals(OPERATOR)).toBe(true);
    });

    it('carries the sheet of the reading it replaced onto the correction', () => {
      expect(corrected().fields[0]?.foundOn?.value).toBe(1);
    });

    it('drops the key where the operator states the paper does not say it', () => {
      const document = corrected().withEdits(
        [edit('document_no', null)],
        OPERATOR,
        AT,
      );

      expect(document.fields).toEqual([]);
    });

    /*
     * The test the extraction stage asks before skipping a paper it takes to be
     * done with. A document whose one value an operator typed has not been read
     * by anything, and counting that as a reading would cancel the reading of
     * every other field on the paper for good.
     */
    it('is not a document a machine has read', () => {
      expect(corrected().hasMachineReadings).toBe(false);
      expect(corrected().hasFields).toBe(true);
    });

    it('leaves the correction alone when the extractor reads the paper again', () => {
      const read = corrected().withFields([aField('document_no')]);

      expect(read.fields).toHaveLength(1);
      expect(read.fields[0]?.value.value).toBe('AZE7654321');
      expect(read.fields[0]?.wasEnteredByOperator).toBe(true);
    });

    it('takes the readings of every key the operator has not spoken for', () => {
      const read = corrected().withFields([
        aField('document_no'),
        aField('first_name'),
      ]);

      expect(
        read.fields.map(field => [field.key.value, field.wasEnteredByOperator]),
      ).toEqual([
        ['document_no', true],
        ['first_name', false],
      ]);
    });
  });
});
