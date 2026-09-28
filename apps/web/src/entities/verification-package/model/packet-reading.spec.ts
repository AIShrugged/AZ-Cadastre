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
  editedByAccountId: null,
  editedAt: null,
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
  // In force: this module picks between readings, and a replaced scan is not a
  // reading the package stands on.
  archiveQrCheck: null,
  // Nor the span working drawn onto a design set's sheets: this module picks
  // between readings of a field, and a picture is not a reading (COMM-165).
  spanMarkup: null,
  supersededById: null,
  supersededAt: null,
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

  // Two profiles spell the same reading differently; where neither is present
  // the line is unread, and where only one is, it answers.
  it('falls back to the owner when nothing applied under the applicant', () => {
    const owner = readPacket(
      detail([document('d1', [field('owner_name', 'OF RECORD', 0.99)])]),
    );
    expect(owner[0]?.field?.value).toBe('OF RECORD');
    expect(owner[0]?.fieldName).toBe('owner_name');
  });

  // The case this rule exists for: one person, read twice. The application was
  // read at 60 % and the plan sheet at 99 %, and the header used to show the
  // worse of the two because `applicant_name` is listed first.
  it('takes the surer reading from a later candidate', () => {
    const readings = readPacket(
      detail([
        document('d1', [field('applicant_name', 'Agaev Kocheli', 0.6)]),
        document('d2', [field('owner_name', 'Ağayev Köçəri', 0.99)]),
      ]),
    );
    expect(readings[0]?.field?.value).toBe('Ağayev Köçəri');
    // Where the value came from, so "open the sheet" opens the sheet it is on.
    expect(readings[0]?.fieldName).toBe('owner_name');
    expect(readings[0]?.documentId).toBe('d2');
  });

  // The parcel's candidates are several too, and answer to the same rule.
  it('takes the surer reading on the parcel line as well', () => {
    const readings = readPacket(
      detail([
        document('d1', [field('cadastral_number', 'AZ-CAD-1024-311', 0.55)]),
        document('d2', [field('inventory_no', 'INV-88-42', 0.97)]),
      ]),
    );
    const parcel = readings.find(r => r.line === 'parcel');
    expect(parcel?.field?.value).toBe('INV-88-42');
    expect(parcel?.fieldName).toBe('inventory_no');
    expect(parcel?.documentId).toBe('d2');
  });

  // Nothing to choose between on confidence, so the order says which reading
  // names the case: the packet is the applicant's.
  it('prefers the applicant when both were read equally well', () => {
    const readings = readPacket(
      detail([
        document('d1', [
          field('owner_name', 'OF RECORD', 0.99),
          field('applicant_name', 'APPLYING', 0.99),
        ]),
      ]),
    );
    expect(readings[0]?.field?.value).toBe('APPLYING');
    expect(readings[0]?.fieldName).toBe('applicant_name');
  });

  // A line no candidate answered to stays absent, however many were tried.
  it('leaves the line unread when no candidate answered', () => {
    const readings = readPacket(
      detail([document('d1', [field('property_address', 'Bakı ş.', 0.95)])]),
    );
    const applicant = readings.find(r => r.line === 'applicant');
    expect(applicant?.field).toBeNull();
    expect(applicant?.fieldName).toBeNull();
    expect(applicant?.documentId).toBeNull();
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
