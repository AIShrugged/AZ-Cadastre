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
