import { describe, expect, it } from 'vitest';

import type { FieldDto } from '@cadastre/api-contracts/verification';

import { fieldsReadHere, isCarriedOver } from './field-origin';

const read = (name: string, confidence: number): FieldDto => ({
  name,
  value: 'Baku, Nizami 12',
  confidence,
  pageNumber: 2,
  origin: 'ReadOnThisDocument',
  takenFrom: null,
});

const confirmed = (name: string, confidence: number): FieldDto => ({
  ...read(name, confidence),
  origin: 'ConfirmedByRegistry',
});

const carried = (name: string, confidence: number): FieldDto => ({
  name,
  value: 'Baku, Nizami 12',
  confidence,
  // Null exactly here: this document has no sheet that states the value.
  pageNumber: null,
  origin: 'TakenFromAnotherDocument',
  takenFrom: {
    documentId: 'doc-source',
    documentType: 'land_plot_plan',
    fieldName: name,
    pageNumber: 5,
  },
});

describe('what a document read for itself', () => {
  it('keeps a reading made on this paper', () => {
    expect(fieldsReadHere([read('property_address', 0.94)])).toHaveLength(1);
  });

  // The register agreed with the reading, it did not supply it — the value is
  // still this paper's own.
  it('keeps a reading the archive register confirmed', () => {
    expect(fieldsReadHere([confirmed('owner_name', 0.91)])).toHaveLength(1);
  });

  it('drops a value carried over from another document', () => {
    expect(fieldsReadHere([carried('property_address', 0.72)])).toEqual([]);
  });

  // The counting rule this module exists for: a carried-over value below the
  // floor is doubt about the paper it was read off, which is reported there.
  it('leaves a doubtful carried-over value out of the paper it hangs on', () => {
    const doubtful = [
      read('owner_name', 0.95),
      carried('property_address', 0.6),
    ];
    const flagged = fieldsReadHere(doubtful).filter(f => f.confidence < 0.8);
    expect(flagged).toEqual([]);
  });

  it('names a carried-over value and nothing else', () => {
    expect(isCarriedOver(carried('property_address', 0.72))).toBe(true);
    expect(isCarriedOver(read('property_address', 0.72))).toBe(false);
    expect(isCarriedOver(confirmed('property_address', 0.72))).toBe(false);
  });
});
