import { describe, expect, it } from 'vitest';

import type {
  DocumentDto,
  PackageDetailDto,
} from '@cadastre/api-contracts/verification';

import {
  needsAGlance,
  PACKET_LINE_KEY,
  PACKET_LINES,
  READ_WELL_ENOUGH,
  readPacket,
  readWellEnough,
} from './packet-reading';

const field = (name: string, value: string, confidence: number) => ({
  name,
  value,
  confidence,
  pageNumber: 1,
  // Read off the document it hangs on, which is what every reading these specs
  // build is. Where a value came from is the case sheet's business, not this
  // module's — it picks between readings by confidence and nothing else.
  origin: 'ReadOnThisDocument' as const,
  takenFrom: null,
});

const document = (id: string, fields: DocumentDto['fields']): DocumentDto => ({
  id,
  firstPage: 1,
  lastPage: 1,
  type: 'application',
  classificationConfidence: 0.99,
  // What the sheets said about the seal and the signature. Nothing this module
  // reads: it picks between readings of a field by confidence and nothing else.
  attestation: null,
  fields,
});

const detail = (documents: DocumentDto[]): PackageDetailDto =>
  ({
    files: [
      {
        id: 'f1',
        originalFilename: 'packet.pdf',
        contentType: 'application/pdf',
        pages: [],
        documents,
      },
    ],
    crossChecks: [],
    registryChecks: [],
    archiveSearchApprovals: [],
    report: null,
  }) as unknown as PackageDetailDto;

describe('what the packet turned out to say', () => {
  it.each(PACKET_LINES)('gives %s a word of its own', line => {
    expect(PACKET_LINE_KEY[line]).toBe(`intake.read.${line}`);
  });

  it('reads the applicant, the address and the parcel off the documents', () => {
    const readings = readPacket(
      detail([
        document('d1', [
          field('applicant_name', 'ELÇİN ƏLİYEV', 0.97),
          field('property_address', 'Bakı ş., Nəsimi r.', 0.95),
          field('cadastral_number', 'AZ-CAD-1024-311', 0.93),
        ]),
      ]),
    );
    expect(readings.map(r => r.field?.value)).toEqual([
      'ELÇİN ƏLİYEV',
      'Bakı ş., Nəsimi r.',
      'AZ-CAD-1024-311',
    ]);
    expect(readings.map(r => r.documentId)).toEqual(['d1', 'd1', 'd1']);
  });

  // A packet that did not yield a line must say so. An absent reading drawn as
  // an empty value is how a case gets opened on a name nobody read.
  it('leaves a line unread rather than inventing one', () => {
    const readings = readPacket(detail([document('d1', [])]));
    expect(readings).toHaveLength(PACKET_LINES.length);
    expect(readings.every(r => r.field === null)).toBe(true);
  });

  // The same value may sit on three sheets, read three ways. The one read worst
  // is not the one to put in front of a person.
  it('keeps the surest reading when a field is on more than one sheet', () => {
    const readings = readPacket(
      detail([
        document('d1', [field('property_address', 'Bakı ş.', 0.41)]),
        document('d2', [field('property_address', 'Bakı şəhəri', 0.88)]),
      ]),
    );
    const address = readings.find(r => r.line === 'address');
    expect(address?.field?.value).toBe('Bakı şəhəri');
    expect(address?.documentId).toBe('d2');
  });

  // Two profiles spell the same reading differently; the preferred name wins
  // where both are present, and the fallback answers where it is not.
  it('prefers the applicant over the owner, and falls back to the owner', () => {
    const both = readPacket(
      detail([
        document('d1', [
          field('owner_name', 'OF RECORD', 0.99),
          field('applicant_name', 'APPLYING', 0.6),
        ]),
      ]),
    );
    expect(both[0]?.field?.value).toBe('APPLYING');

    const owner = readPacket(
      detail([document('d1', [field('owner_name', 'OF RECORD', 0.99)])]),
    );
    expect(owner[0]?.field?.value).toBe('OF RECORD');
  });

  it('asks for a glance only at a reading it is unsure of', () => {
    const [sure] = readPacket(
      detail([document('d1', [field('applicant_name', 'A', 0.99)])]),
    );
    const [unsure] = readPacket(
      detail([
        document('d1', [field('applicant_name', 'A', READ_WELL_ENOUGH - 0.01)]),
      ]),
    );
    const [unread] = readPacket(detail([document('d1', [])]));
    expect(needsAGlance(sure!)).toBe(false);
    expect(needsAGlance(unsure!)).toBe(true);
    // Nothing read is not something read badly: there is no sheet to glance at.
    expect(needsAGlance(unread!)).toBe(false);
  });

  // The register's rows ask the same question of the `StatedValueDto` the list
  // endpoint publishes, so the threshold is asked in one place and not copied
  // into the table. Two copies is how a row and its case sheet come to disagree
  // about which reading is worth a second look.
  it('answers the threshold for a bare confidence too', () => {
    expect(readWellEnough(0.99)).toBe(true);
    expect(readWellEnough(READ_WELL_ENOUGH)).toBe(true);
    expect(readWellEnough(READ_WELL_ENOUGH - 0.01)).toBe(false);
    expect(readWellEnough(0)).toBe(false);
  });

  it('agrees with the glance it is asked through', () => {
    const [unsure] = readPacket(
      detail([
        document('d1', [field('applicant_name', 'A', READ_WELL_ENOUGH - 0.01)]),
      ]),
    );
    expect(needsAGlance(unsure!)).toBe(
      !readWellEnough(unsure!.field!.confidence),
    );
  });
});
