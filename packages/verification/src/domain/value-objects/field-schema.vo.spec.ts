import { describe, expect, it } from 'vitest';

import { InvalidFieldKeyException } from '../exceptions/index.js';

import { FieldSchema, FieldSpec } from './field-schema.vo.js';
import { FieldKey } from './field.vo.js';

describe('FieldSpec', () => {
  it('carries the key the extractor is held to and the label a human reads', () => {
    const spec = FieldSpec.of('first_name', 'First name');

    expect(spec.key.equals(FieldKey.create('first_name'))).toBe(true);
    expect(spec.label).toBe('First name');
  });

  it('holds its key to the field key rule', () => {
    expect(() => FieldSpec.of('  ', 'Nothing')).toThrow(
      InvalidFieldKeyException,
    );
  });
});

describe('FieldSchema', () => {
  it('declares the fields a document type asks for, in the order they were given', () => {
    const schema = FieldSchema.of([
      FieldSpec.of('first_name', 'First name'),
      FieldSpec.of('last_name', 'Last name'),
    ]);

    expect(schema.specs.map(spec => spec.key.value)).toEqual([
      'first_name',
      'last_name',
    ]);
  });

  it('reads a type with nothing to pull as an empty schema, not as absence', () => {
    expect(FieldSchema.none().specs).toEqual([]);
    expect(FieldSchema.none().isEmpty).toBe(true);
  });

  it('is not empty once it declares a field', () => {
    expect(FieldSchema.of([FieldSpec.of('dob', 'Date of birth')]).isEmpty).toBe(
      false,
    );
  });

  it('counts a schema built from no specs as empty', () => {
    expect(FieldSchema.of([]).isEmpty).toBe(true);
  });

  it('declares a key it was built with', () => {
    const schema = FieldSchema.of([FieldSpec.of('parcel_id', 'Parcel ID')]);

    expect(schema.declares(FieldKey.create('parcel_id'))).toBe(true);
  });

  it('does not declare a key it was never given', () => {
    const schema = FieldSchema.of([FieldSpec.of('parcel_id', 'Parcel ID')]);

    expect(schema.declares(FieldKey.create('owner_name'))).toBe(false);
  });

  it('declares nothing at all when it has nothing to pull', () => {
    expect(FieldSchema.none().declares(FieldKey.create('parcel_id'))).toBe(
      false,
    );
  });

  it('keeps its own copy of the specs, so the list it was built from cannot change it', () => {
    const specs = [FieldSpec.of('parcel_id', 'Parcel ID')];
    const schema = FieldSchema.of(specs);

    specs.push(FieldSpec.of('area', 'Area'));

    expect(schema.specs).toHaveLength(1);
    expect(schema.declares(FieldKey.create('area'))).toBe(false);
  });
});
