import { describe, expect, it } from 'vitest';

import {
  CONFIDENCE_FLOOR,
  type FieldDto,
} from '@cadastre/api-contracts/verification';

import {
  fieldsReadHere,
  isCarriedOver,
  isOperatorEntered,
  isScored,
} from './field-origin';

const read = (name: string, confidence: number): FieldDto => ({
  name,
  value: 'Baku, Nizami 12',
  confidence,
  pageNumber: 2,
  origin: 'ReadOnThisDocument',
  takenFrom: null,
  editedByAccountId: null,
  editedAt: null,
});

const confirmed = (name: string, confidence: number): FieldDto => ({
  ...read(name, confidence),
  origin: 'ConfirmedByRegistry',
});

const corrected = (name: string): FieldDto => ({
  ...read(name, 1),
  origin: 'EnteredByOperator',
  editedByAccountId: 'acct-7',
  editedAt: '2026-09-21T09:00:00.000Z',
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
  editedByAccountId: null,
  editedAt: null,
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
    const flagged = fieldsReadHere(doubtful).filter(
      f => f.confidence < CONFIDENCE_FLOOR,
    );
    expect(flagged).toEqual([]);
  });

  // A person read the sheet, so the value answers for this paper exactly as a
  // machine reading of it does.
  it('keeps a value an operator typed off this paper', () => {
    expect(fieldsReadHere([corrected('owner_name')])).toHaveLength(1);
  });

  it('names a carried-over value and nothing else', () => {
    expect(isCarriedOver(carried('property_address', 0.72))).toBe(true);
    expect(isCarriedOver(read('property_address', 0.72))).toBe(false);
    expect(isCarriedOver(confirmed('property_address', 0.72))).toBe(false);
  });
});

describe('a value a person entered', () => {
  it('is named, and no machine reading is', () => {
    expect(isOperatorEntered(corrected('owner_name'))).toBe(true);
    expect(isOperatorEntered(read('owner_name', 1))).toBe(false);
    expect(isOperatorEntered(confirmed('owner_name', 1))).toBe(false);
    expect(isOperatorEntered(carried('owner_name', 0.7))).toBe(false);
  });

  // The contract sends 1 because it has to send something; nothing scored it.
  it('carries no figure worth printing, where every reading does', () => {
    expect(isScored(corrected('owner_name'))).toBe(false);
    expect(isScored(read('owner_name', 0.94))).toBe(true);
    expect(isScored(carried('owner_name', 0.7))).toBe(true);
  });
});
