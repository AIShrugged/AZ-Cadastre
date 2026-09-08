import { describe, expect, it } from 'vitest';

import { Classification } from './classification.vo.js';
import { Confidence } from './confidence.vo.js';
import { DocumentType } from './document-type.vo.js';

describe('Classification', () => {
  it('carries the type the classifier chose and how sure it was', () => {
    const classification = Classification.of(
      DocumentType.create('passport'),
      Confidence.of(0.88),
    );

    expect(classification.type.value).toBe('passport');
    expect(classification.confidence.value).toBe(0.88);
  });

  it('reads a document the classifier could not place as unplaced', () => {
    const classification = Classification.unplaced(Confidence.of(0.2));

    expect(classification.type).toBe(DocumentType.UNKNOWN);
    expect(classification.confidence.value).toBe(0.2);
  });

  it('is placed once there is a type to look a field schema up by', () => {
    expect(
      Classification.of(DocumentType.create('title_deed'), Confidence.of(0.7))
        .isPlaced,
    ).toBe(true);
  });

  it('is not placed when the classifier ran and could not decide', () => {
    expect(Classification.unplaced(Confidence.of(0.2)).isPlaced).toBe(false);
  });

  it('is not placed when the unknown type was chosen outright', () => {
    expect(
      Classification.of(DocumentType.UNKNOWN, Confidence.of(0.9)).isPlaced,
    ).toBe(false);
  });

  it('keeps a low confidence as a real decision rather than refusing it', () => {
    const classification = Classification.of(
      DocumentType.create('passport'),
      Confidence.none(),
    );

    expect(classification.isPlaced).toBe(true);
    expect(classification.confidence.value).toBe(0);
  });

  it('reads a document the profile does not ask for as out of profile, with no name of its own', () => {
    const classification = Classification.outOfProfile(Confidence.of(0.8));

    expect(classification.type).toBe(DocumentType.OUT_OF_PROFILE);
    expect(classification.knownAs).toBeNull();
    expect(classification.isNamed).toBe(false);
  });

  it('carries the catalogue entry an out-of-profile document was recognised as', () => {
    const classification = Classification.outOfProfile(
      Confidence.of(0.8),
      DocumentType.create('courier_waybill'),
    );

    expect(classification.knownAs?.value).toBe('courier_waybill');
    expect(classification.isNamed).toBe(true);
  });

  // The name says what the paper is; it never says the profile asked for it.
  it('is still not placed once it has a name', () => {
    const classification = Classification.outOfProfile(
      Confidence.of(0.8),
      DocumentType.create('courier_waybill'),
    );

    expect(classification.isPlaced).toBe(false);
    expect(classification.isOutOfProfile).toBe(true);
    expect(classification.type.value).toBe('out_of_profile');
  });

  it('leaves a placed reading unnamed, because the name is what the profile has none of', () => {
    expect(
      Classification.of(DocumentType.create('passport'), Confidence.of(0.9))
        .knownAs,
    ).toBeNull();
    expect(Classification.unplaced(Confidence.of(0.2)).knownAs).toBeNull();
  });

  it('is equal to another decision of the same type at the same confidence', () => {
    const first = Classification.of(
      DocumentType.create('passport'),
      Confidence.of(0.5),
    );
    const second = Classification.of(
      DocumentType.create('passport'),
      Confidence.of(0.5),
    );

    expect(first.equals(second)).toBe(true);
  });

  it('differs when the type differs', () => {
    const passport = Classification.of(
      DocumentType.create('passport'),
      Confidence.of(0.5),
    );
    const deed = Classification.of(
      DocumentType.create('title_deed'),
      Confidence.of(0.5),
    );

    expect(passport.equals(deed)).toBe(false);
  });

  it('is equal to another out-of-profile decision named the same', () => {
    const first = Classification.outOfProfile(
      Confidence.of(0.8),
      DocumentType.create('courier_waybill'),
    );
    const second = Classification.outOfProfile(
      Confidence.of(0.8),
      DocumentType.create('courier_waybill'),
    );

    expect(first.equals(second)).toBe(true);
  });

  it('differs when the name differs, and when one has a name and the other has none', () => {
    const waybill = Classification.outOfProfile(
      Confidence.of(0.8),
      DocumentType.create('courier_waybill'),
    );
    const letter = Classification.outOfProfile(
      Confidence.of(0.8),
      DocumentType.create('covering_letter'),
    );
    const nameless = Classification.outOfProfile(Confidence.of(0.8));

    expect(waybill.equals(letter)).toBe(false);
    expect(waybill.equals(nameless)).toBe(false);
    expect(nameless.equals(waybill)).toBe(false);
  });

  it('differs when only the confidence differs, because the two travel together', () => {
    const sure = Classification.of(
      DocumentType.create('passport'),
      Confidence.of(0.9),
    );
    const unsure = Classification.of(
      DocumentType.create('passport'),
      Confidence.of(0.4),
    );

    expect(sure.equals(unsure)).toBe(false);
  });
});
