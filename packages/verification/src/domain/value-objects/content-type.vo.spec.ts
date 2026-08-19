import { describe, expect, it } from 'vitest';

import { UnsupportedContentTypeException } from '../exceptions/index.js';

import { ContentType } from './content-type.vo.js';

describe('ContentType', () => {
  it('accepts each format the system takes uploads in', () => {
    expect(ContentType.of('application/pdf')).toBe(ContentType.PDF);
    expect(ContentType.of('image/jpeg')).toBe(ContentType.JPEG);
    expect(ContentType.of('image/png')).toBe(ContentType.PNG);
  });

  it('refuses a format the system does not accept', () => {
    expect(() => ContentType.of('image/gif')).toThrow(
      UnsupportedContentTypeException,
    );
    expect(() => ContentType.of('application/msword')).toThrow(
      UnsupportedContentTypeException,
    );
  });

  it('refuses an empty format', () => {
    expect(() => ContentType.of('')).toThrow(UnsupportedContentTypeException);
  });

  it('refuses a media type that only looks right', () => {
    expect(() => ContentType.of('application/PDF')).toThrow(
      UnsupportedContentTypeException,
    );
    expect(() => ContentType.of(' application/pdf ')).toThrow(
      UnsupportedContentTypeException,
    );
  });

  it('says what it was handed when it refuses', () => {
    expect(() => ContentType.of('image/gif')).toThrow(/"image\/gif"/);
  });

  it('lists every format it accepts', () => {
    expect(ContentType.all.map(type => type.value)).toEqual([
      'application/pdf',
      'image/jpeg',
      'image/png',
    ]);
  });

  it('hands back the one instance, so a format is never two values', () => {
    expect(ContentType.of('image/png')).toBe(ContentType.of('image/png'));
  });

  it('splits a PDF into pages before OCR, because it carries many', () => {
    expect(ContentType.PDF.splitsIntoPages).toBe(true);
  });

  it('does not split an image, because it is exactly one page', () => {
    expect(ContentType.JPEG.splitsIntoPages).toBe(false);
    expect(ContentType.PNG.splitsIntoPages).toBe(false);
  });

  it('is equal to another content type of the same format', () => {
    expect(ContentType.PDF.equals(ContentType.of('application/pdf'))).toBe(
      true,
    );
    expect(ContentType.PDF.equals(ContentType.PNG)).toBe(false);
  });
});
