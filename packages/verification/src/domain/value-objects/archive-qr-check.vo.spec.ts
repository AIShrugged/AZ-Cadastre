import { describe, expect, it } from 'vitest';

import { InvalidArchiveQrCheckException } from '../exceptions/index.js';

import {
  ARCHIVE_QR_FIELDS,
  ArchiveQrCheck,
  ArchiveQrFieldCheck,
} from './archive-qr-check.vo.js';

const QR = 'https://qr.esd.milliarxiv.gov.az/F130-S1-I476-V98';
const AT = new Date('2026-09-16T12:00:00.000Z');

function lines(verdict = 'Match'): readonly ArchiveQrFieldCheck[] {
  return ARCHIVE_QR_FIELDS.map(name =>
    ArchiveQrFieldCheck.of({
      name,
      documentValue: 'x',
      archiveValue: 'x',
      verdict,
    }),
  );
}

describe('ArchiveQrCheck', () => {
  it('derives the status from the lines and the competence, never takes it', () => {
    expect(
      ArchiveQrCheck.restore({
        status: 'Differs',
        qrReference: QR,
        checkedAt: AT,
        issuingAuthorityCompetent: true,
        fields: lines(),
      }).status,
    ).toBe('Confirmed');
  });

  it('publishes the lines in the order the contract names them', () => {
    const check = ArchiveQrCheck.found({
      qrReference: QR,
      checkedAt: AT,
      issuingAuthorityCompetent: true,
      fields: [...lines()].reverse(),
    });

    expect(check.fields.map(field => field.name)).toEqual([
      ...ARCHIVE_QR_FIELDS,
    ]);
  });

  // A reader must never have to wonder whether a line is absent because it
  // agreed.
  it('refuses an answer that leaves a line out or names one twice', () => {
    const [first, ...rest] = lines();

    expect(() =>
      ArchiveQrCheck.found({
        qrReference: QR,
        checkedAt: AT,
        issuingAuthorityCompetent: true,
        fields: rest,
      }),
    ).toThrow(InvalidArchiveQrCheckException);
    expect(() =>
      ArchiveQrCheck.found({
        qrReference: QR,
        checkedAt: AT,
        issuingAuthorityCompetent: true,
        fields: [first!, first!, ...rest.slice(1)],
      }),
    ).toThrow(InvalidArchiveQrCheckException);
  });

  it('refuses a verdict about a value one side never gave', () => {
    expect(() =>
      ArchiveQrFieldCheck.of({
        name: 'plot_area',
        documentValue: null,
        archiveValue: '0,04 ha',
        verdict: 'Mismatch',
      }),
    ).toThrow(InvalidArchiveQrCheckException);
  });

  it('refuses a line, a verdict or a status it does not know', () => {
    expect(() =>
      ArchiveQrFieldCheck.of({
        name: 'qr_code',
        documentValue: 'x',
        archiveValue: 'x',
        verdict: 'Match',
      }),
    ).toThrow(InvalidArchiveQrCheckException);
    expect(() =>
      ArchiveQrFieldCheck.of({
        name: 'plot_area',
        documentValue: 'x',
        archiveValue: 'x',
        verdict: 'Close',
      }),
    ).toThrow(InvalidArchiveQrCheckException);
    expect(() =>
      ArchiveQrCheck.restore({
        status: 'Ambiguous',
        qrReference: QR,
        checkedAt: AT,
        issuingAuthorityCompetent: null,
        fields: [],
      }),
    ).toThrow(InvalidArchiveQrCheckException);
  });

  it('restores the two answers that compared nothing as they were stored', () => {
    const notFound = ArchiveQrCheck.restore({
      status: 'NotFound',
      qrReference: QR,
      checkedAt: AT,
      issuingAuthorityCompetent: null,
      fields: [],
    });
    const noQrCode = ArchiveQrCheck.restore({
      status: 'NoQrCode',
      qrReference: null,
      checkedAt: AT,
      issuingAuthorityCompetent: null,
      fields: [],
    });

    expect([notFound.status, notFound.isUnanswered]).toEqual([
      'NotFound',
      true,
    ]);
    expect([noQrCode.status, noQrCode.qrReference]).toEqual(['NoQrCode', null]);
  });
});
