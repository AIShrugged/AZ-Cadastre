import { describe, expect, it } from 'vitest';

import { InvalidRegistryCheckKeyException } from '../exceptions/index.js';

import { Confidence } from './confidence.vo.js';
import { CheckedValue } from './cross-check.vo.js';
import { DocumentType } from './document-type.vo.js';
import { DocumentId } from './entity-ids/index.js';
import { FieldKey, FieldValue } from './field.vo.js';
import { PageNumber } from './page-number.vo.js';
import {
  RegistryAttribute,
  RegistryCheck,
  RegistryCheckKey,
} from './registry-check.vo.js';
import { RegistryOutcome } from './registry-outcome.vo.js';

function aValue(
  field = 'property_address',
  value = 'Zığ qəs., Əliyev küç. 12',
) {
  return CheckedValue.of({
    documentId: DocumentId.of('0190a1b2-c3d4-7e5f-8a9b-000000000001'),
    documentType: DocumentType.create('application'),
    fieldKey: FieldKey.create(field),
    value: FieldValue.create(value),
    foundOn: PageNumber.first(),
    confidence: Confidence.of(0.9),
  });
}

function anAttribute(
  overrides: Partial<{ agrees: boolean; recorded: string | null }> = {},
) {
  return RegistryAttribute.of({
    name: 'ownerName',
    agrees: overrides.agrees ?? false,
    submitted: aValue('owner_name', 'Əliyeva Rübabə'),
    recorded:
      overrides.recorded === undefined
        ? 'Quliyev Rəşad Tofiq oğlu'
        : overrides.recorded,
  });
}

function aCheck(
  outcome: RegistryOutcome,
  attributes: readonly RegistryAttribute[] = [],
) {
  return RegistryCheck.of({
    key: RegistryCheckKey.create('property_of_record'),
    outcome,
    confidence: Confidence.of(0.9),
    note: '  Register 1-12345 holds this address.  ',
    asked: aValue(),
    reference: 'folder 14, pp. 01-dən 30',
    attributes,
  });
}

describe('RegistryCheckKey', () => {
  it('refuses an empty key', () => {
    expect(() => RegistryCheckKey.create('   ')).toThrow(
      InvalidRegistryCheckKeyException,
    );
  });

  it('refuses one longer than a key has any business being', () => {
    expect(() => RegistryCheckKey.create('x'.repeat(65))).toThrow(
      InvalidRegistryCheckKeyException,
    );
  });
});

describe('RegistryAttribute', () => {
  it('is silent, not in disagreement, when the record does not carry it', () => {
    const attribute = anAttribute({ recorded: null });

    expect(attribute.isSilent).toBe(true);
    expect(attribute.differs).toBe(false);
  });

  it('differs only when the record carries a value and it is another one', () => {
    expect(anAttribute({ agrees: false }).differs).toBe(true);
    expect(anAttribute({ agrees: true }).differs).toBe(false);
  });

  it('cites both sides, so a reader can see what was held against what', () => {
    expect(anAttribute().cited).toContain('Quliyev Rəşad Tofiq oğlu');
    expect(anAttribute().cited).toContain('Əliyeva Rübabə');
  });
});

describe('RegistryCheck', () => {
  it('keeps the archive locator, which is where the inspector goes next', () => {
    expect(aCheck(RegistryOutcome.CONFIRMED).reference).toBe(
      'folder 14, pp. 01-dən 30',
    );
  });

  it('trims the audit line it was handed', () => {
    expect(aCheck(RegistryOutcome.CONFIRMED).note).toBe(
      'Register 1-12345 holds this address.',
    );
  });

  it('cites only what the record actually disagreed with', () => {
    const check = aCheck(RegistryOutcome.DIFFERS, [
      anAttribute({ agrees: false }),
      anAttribute({ recorded: null }),
      anAttribute({ agrees: true }),
    ]);

    expect(check.differing).toHaveLength(1);
  });

  it('needs no attributes at all: a lookup that found nothing has none', () => {
    const check = aCheck(RegistryOutcome.NOT_FOUND);

    expect(check.attributes).toEqual([]);
    expect(check.needsInspector).toBe(true);
    expect(check.contradicts).toBe(false);
  });
});
