import { describe, expect, it } from 'vitest';

import {
  CheckedValue,
  Confidence,
  DocumentId,
  DocumentType,
  EditorAccountId,
  FieldKey,
  FieldOrigin,
  FieldValue,
  PageNumber,
} from '../value-objects/index.js';

import { ExtractedField } from './extracted-field.entity.js';

function aField(confidence: Confidence, key = 'passport_no'): ExtractedField {
  return ExtractedField.of(
    FieldKey.create(key),
    FieldValue.create('AZE1234567'),
    confidence,
    PageNumber.first(),
  );
}

const SOURCE_ID = '0190a1b2-c3d4-7e5f-8a9b-00000000000a';

// The reading on another paper of the package that a carried-over value is
// copied from.
function readElsewhere(confidence = 0.9): CheckedValue {
  return CheckedValue.of({
    documentId: DocumentId.of(SOURCE_ID),
    documentType: DocumentType.create('land_plot_plan'),
    fieldKey: FieldKey.create('property_address'),
    value: FieldValue.create('Zığ qəsəbəsi, Əliyev küçəsi 12'),
    foundOn: PageNumber.of(3),
    confidence: Confidence.of(confidence),
  });
}

describe('ExtractedField', () => {
  it('carries the key it answers, the value pulled, how sure the extractor was and where it was read', () => {
    const field = ExtractedField.of(
      FieldKey.create('parcel_id'),
      FieldValue.create('AZ-01-234'),
      Confidence.of(0.81),
      PageNumber.of(2),
    );

    expect(field.key.equals(FieldKey.create('parcel_id'))).toBe(true);
    expect(field.value.equals(FieldValue.create('AZ-01-234'))).toBe(true);
    expect(field.confidence.value).toBe(0.81);
    expect(field.foundOn?.equals(PageNumber.of(2))).toBe(true);
  });

  it('warns the inspector about a value the extractor was unsure of', () => {
    expect(aField(Confidence.of(0.4)).isBelow(Confidence.of(0.6))).toBe(true);
  });

  it('does not warn about a value the extractor was sure enough of', () => {
    expect(aField(Confidence.of(0.9)).isBelow(Confidence.of(0.6))).toBe(false);
  });

  it('does not warn about a value sitting exactly on the threshold', () => {
    expect(aField(Confidence.of(0.6)).isBelow(Confidence.of(0.6))).toBe(false);
  });

  it('always warns about a value the extractor had no confidence in', () => {
    expect(aField(Confidence.none()).isBelow(Confidence.of(0.01))).toBe(true);
  });

  it('was read here, unless it says otherwise', () => {
    expect(aField(Confidence.of(0.9)).wasReadHere).toBe(true);
    expect(aField(Confidence.of(0.9)).origin).toBe(
      FieldOrigin.READ_ON_THIS_DOCUMENT,
    );
  });

  describe('carried over from another paper of the package', () => {
    const key = FieldKey.create('property_address');

    it('is the value that other paper states', () => {
      expect(ExtractedField.takenFrom(key, readElsewhere()).value.value).toBe(
        'Zığ qəsəbəsi, Əliyev küçəsi 12',
      );
    });

    it('says it was not read here, and names the paper that read it', () => {
      const field = ExtractedField.takenFrom(key, readElsewhere());

      expect(field.wasReadHere).toBe(false);
      expect(field.origin).toBe(FieldOrigin.TAKEN_FROM_ANOTHER_DOCUMENT);
      expect(field.takenFrom?.documentId.value).toBe(SOURCE_ID);
      expect(field.takenFrom?.documentType.value).toBe('land_plot_plan');
      expect(field.takenFrom?.fieldKey.value).toBe('property_address');
    });

    /*
     * Null and not the source's sheet: `foundOn` is read as a page of the
     * document the field hangs on, and a foreign number there would open the
     * wrong paper. The source's sheet is on the source, where it means
     * something (ADR-0023).
     */
    it('cites no sheet of this document, and keeps the source sheet on the source', () => {
      const field = ExtractedField.takenFrom(key, readElsewhere());

      expect(field.foundOn).toBeNull();
      expect(field.takenFrom?.foundOn.value).toBe(3);
    });

    it('is never surer than the reading it was copied from', () => {
      expect(
        ExtractedField.takenFrom(key, readElsewhere(0.6)).confidence.value,
      ).toBeLessThan(0.6);
    });

    // The register was asked about the paper that states the value, and the
    // answer belongs there — not on a copy of it hanging off another document.
    it('cannot be marked confirmed by the register', () => {
      const field = ExtractedField.takenFrom(key, readElsewhere());

      expect(field.confirmedByRegistry().origin).toBe(
        FieldOrigin.TAKEN_FROM_ANOTHER_DOCUMENT,
      );
    });
  });

  describe('confirmed by the archive register', () => {
    it('is still a reading of this paper, on the sheet it was read', () => {
      const field = aField(Confidence.of(0.9)).confirmedByRegistry();

      expect(field.origin).toBe(FieldOrigin.CONFIRMED_BY_REGISTRY);
      expect(field.wasReadHere).toBe(true);
      expect(field.foundOn?.value).toBe(1);
    });

    // The register agreed with what the paper says; it did not read the paper
    // better than the reader did.
    it('is no surer for having been agreed with', () => {
      expect(
        aField(Confidence.of(0.9)).confirmedByRegistry().confidence.value,
      ).toBe(0.9);
    });
  });

  /*
   * What an operator typed off the paper in front of them, because the reader
   * got the field wrong or never got it at all (ADR-0033).
   */
  describe('entered by an operator', () => {
    const OPERATOR = EditorAccountId.of('0190a1b2-c3d4-7e5f-8a9b-0000000000aa');
    const AT = new Date('2026-09-21T10:00:00.000Z');

    function typed(foundOn: PageNumber | null = PageNumber.of(2)) {
      return ExtractedField.enteredByOperator(
        FieldKey.create('property_address'),
        FieldValue.create('Zığ qəsəbəsi, Əliyev küçəsi 21'),
        foundOn,
        OPERATOR,
        AT,
      );
    }

    /*
     * A person read the paper, so the value answers for the paper: it may be a
     * side of a cross-document check and may be what the register is asked
     * about. Were it anything else the correction would change nothing
     * downstream.
     */
    it('is a reading of the document it hangs on', () => {
      expect(typed().origin).toBe(FieldOrigin.ENTERED_BY_OPERATOR);
      expect(typed().wasReadHere).toBe(true);
    });

    // Not a reading by anything the extraction stage may skip a paper over: a
    // document whose only values were typed in has not been read (ADR-0033).
    it('is not a machine reading', () => {
      expect(typed().wasReadByTheMachine).toBe(false);
      expect(typed().wasEnteredByOperator).toBe(true);
    });

    /*
     * A figure a person read off the sheet is not a reading with a probability
     * attached. This is what keeps a correction out of the report's
     * low-confidence findings, where it would send an inspector back to the one
     * value somebody has already looked at.
     */
    it('is certain, and never a doubted reading', () => {
      expect(typed().confidence.value).toBe(1);
      expect(typed().isBelow(Confidence.FLOOR)).toBe(false);
    });

    it('cites the sheet of the reading it replaced', () => {
      expect(typed().foundOn?.value).toBe(2);
    });

    // Nothing was read, so there is no sheet to send an inspector to.
    it('cites no sheet where the operator states a value nothing was read for', () => {
      expect(typed(null).foundOn).toBeNull();
    });

    it('records who corrected it and when', () => {
      expect(typed().editedBy?.equals(OPERATOR)).toBe(true);
      expect(typed().editedAt).toBe(AT);
    });

    /*
     * The origin records where the value came from, and where it came from is a
     * person. The register's agreement is already on the registry check that
     * asked, and overwriting the origin with it would lose the one fact an
     * inspector most needs about the field (ADR-0033).
     */
    it('is left alone by the archive register agreeing with it', () => {
      const field = typed().confirmedByRegistry();

      expect(field.origin).toBe(FieldOrigin.ENTERED_BY_OPERATOR);
      expect(field.editedBy?.equals(OPERATOR)).toBe(true);
    });
  });
});
