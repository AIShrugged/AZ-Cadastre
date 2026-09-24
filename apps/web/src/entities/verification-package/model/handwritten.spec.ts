import { describe, expect, it } from 'vitest';

import type { FieldDto } from '@cadastre/api-contracts/verification';

import { isHandwritten, isMachineDecoded } from './handwritten';

const field = (name: string, value: string): FieldDto => ({
  name,
  value,
  confidence: 0.94,
  pageNumber: 2,
  origin: 'ReadOnThisDocument',
  takenFrom: null,
  editedByAccountId: null,
  editedAt: null,
});

const QR_LINK = 'https://e-cadastre.az/verify?id=AZ-2019-004512-77&n=2019';

describe('isMachineDecoded', () => {
  it('names the QR line, which is decoded rather than read', () => {
    expect(isMachineDecoded(field('qr_code', QR_LINK))).toBe(true);
  });

  it('leaves every read field alone', () => {
    expect(isMachineDecoded(field('owner_name', 'Əliyev Rəşad'))).toBe(false);
  });
});

describe('isHandwritten', () => {
  it('marks a value the transcription marked end to end', () => {
    const source = 'Qeydiyyat nömrəsi: [hw: Əliyev Rəşad Elman oğlu]';

    expect(
      isHandwritten(field('owner_name', 'Əliyev Rəşad Elman oğlu'), source),
    ).toBe(true);
  });

  it('marks a handwritten entry inside a printed phrase', () => {
    const source = 'Ünvan: Bakı, [hw: Nizami 12]';

    expect(isHandwritten(field('address', 'Bakı, Nizami 12'), source)).toBe(
      true,
    );
  });

  it('never marks the QR line, however the page was written', () => {
    const source = `[qr] Tarix: [hw: 2019] İmza: [signature]`;

    expect(isHandwritten(field('qr_code', QR_LINK), source)).toBe(false);
  });

  it('ignores a short marked fragment buried in a long value', () => {
    const source = 'Tarix: [hw: 2019]';
    const value = 'Bakı şəhəri, Nizami rayonu, sahə 2019 kv.m';

    expect(isHandwritten(field('description', value), source)).toBe(false);
  });

  it('says nothing about a value no fragment matches', () => {
    const source = 'Ünvan: [hw: Nizami 12]';

    expect(isHandwritten(field('owner_name', 'Əliyev Rəşad'), source)).toBe(
      false,
    );
  });
});
