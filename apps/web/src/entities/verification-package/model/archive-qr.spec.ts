import { describe, expect, it } from 'vitest';

import {
  ArchiveQrCheckStatusSchema,
  ArchiveQrFieldNameSchema,
  ArchiveQrFieldVerdictSchema,
  type ArchiveQrCheckDto,
  type ArchiveQrCheckStatus,
  type ArchiveQrFieldCheckDto,
  type ArchiveQrFieldVerdict,
} from '@cadastre/api-contracts/verification';

import {
  comparesLines,
  competence,
  COMPETENCE_KEY,
  COMPETENCE_TONE,
  QR_FIELD_ORDER,
  QR_STATUS_KEY,
  QR_STATUS_NOTE,
  QR_STATUS_TONE,
  QR_VERDICT_KEY,
  QR_VERDICT_TONE,
  qrDisagreements,
  qrFields,
  qrSpeaksAgainst,
} from './archive-qr';

const STATUSES = ArchiveQrCheckStatusSchema.options;
const VERDICTS = ArchiveQrFieldVerdictSchema.options;
const NAMES = ArchiveQrFieldNameSchema.options;

const line = (
  name: ArchiveQrFieldCheckDto['name'],
  verdict: ArchiveQrFieldVerdict,
  documentValue: string | null = 'stated',
  archiveValue: string | null = 'stated',
): ArchiveQrFieldCheckDto => ({
  name,
  documentValue,
  archiveValue,
  verdict,
});

/** Every line agreeing, which is the check a well-formed Decree 439 paper
 *  comes back with. */
const allEight = (verdict: ArchiveQrFieldVerdict = 'Match') =>
  NAMES.map(name => line(name, verdict));

const check = (
  status: ArchiveQrCheckStatus,
  over: Partial<ArchiveQrCheckDto> = {},
): ArchiveQrCheckDto => ({
  status,
  qrReference: status === 'NoQrCode' ? null : 'NAF-439/1997-04812',
  // Named only where the code was decoded and nobody here could be asked
  // (ADR-0034).
  issuer: status === 'IssuerNotConnected' ? 'e-emlak.gov.az' : null,
  signature: null,
  checkedAt: '2026-09-21T09:15:00.000Z',
  issuingAuthorityCompetent:
    status === 'Confirmed' ? true : status === 'Differs' ? false : null,
  fields:
    status === 'Confirmed'
      ? allEight()
      : status === 'Differs'
        ? allEight()
        : [],
  ...over,
});

describe('what the archive said about one paper, as the reader is shown it', () => {
  // The contract may gain a status; a client that drew nothing for it would
  // leave the answer blank in the entry of the document it is about.
  it.each(STATUSES)('gives %s a tone, a word and a sentence', status => {
    expect(QR_STATUS_TONE[status]).toBeDefined();
    expect(QR_STATUS_KEY[status]).toBeDefined();
    expect(QR_STATUS_NOTE[status]).toBeDefined();
  });

  it.each(VERDICTS)('gives %s a tone and a word', verdict => {
    expect(QR_VERDICT_TONE[verdict]).toBeDefined();
    expect(QR_VERDICT_KEY[verdict]).toBeDefined();
  });

  // The point of the block. "The archive's copy says otherwise" is a finding;
  // "the fonds hold no file under that reference" and "no reference was read
  // off the paper" are not, and a fault's colour on either would state a
  // shortfall nobody claimed (ADR-0028, ADR-0031).
  it('keeps a disagreement and a silence in different tones', () => {
    expect(QR_STATUS_TONE.Differs).not.toBe(QR_STATUS_TONE.NotFound);
    expect(QR_STATUS_TONE.Differs).not.toBe(QR_STATUS_TONE.NoQrCode);
    expect(QR_STATUS_TONE.NotFound).toBe('silent');
    expect(QR_STATUS_TONE.NoQrCode).toBe('silent');
  });

  // The two silences share a tone, so the word is the only thing telling them
  // apart — and it has to.
  it('still says which silence it is', () => {
    expect(QR_STATUS_KEY.NotFound).not.toBe(QR_STATUS_KEY.NoQrCode);
    expect(QR_STATUS_NOTE.NotFound).not.toBe(QR_STATUS_NOTE.NoQrCode);
  });

  it('never draws silence on a line as a disagreement', () => {
    expect(QR_VERDICT_TONE.NotStated).toBe('silent');
    expect(QR_VERDICT_TONE.NotStated).not.toBe(QR_VERDICT_TONE.Mismatch);
  });

  it('holds only a disagreement against the package', () => {
    expect(qrSpeaksAgainst(check('Differs'))).toBe(true);
    expect(qrSpeaksAgainst(check('Confirmed'))).toBe(false);
    expect(qrSpeaksAgainst(check('NotFound'))).toBe(false);
    expect(qrSpeaksAgainst(check('NoQrCode'))).toBe(false);
  });
});

describe('the eight lines held against the archive', () => {
  it('publishes them in the contract order', () => {
    expect(QR_FIELD_ORDER).toEqual(NAMES);
    expect(QR_FIELD_ORDER).toHaveLength(8);
  });

  // The wire may send them in any order, and a table whose rows moved between
  // two documents of the same kind is a table an inspector cannot scan.
  it('sorts what the wire sent back into that order', () => {
    const shuffled = [...allEight()].reverse();

    expect(
      qrFields(check('Confirmed', { fields: shuffled })).map(f => f.name),
    ).toEqual([...NAMES]);
  });

  // A ninth line the engine learns to hold against the archive must not vanish
  // from the table because this client has never heard of it.
  it('keeps a line it does not know, at the end', () => {
    const unknown = {
      ...line('document_no', 'Match'),
      name: 'plan_scale' as ArchiveQrFieldCheckDto['name'],
    };

    const names = qrFields(
      check('Confirmed', { fields: [unknown, ...allEight()] }),
    ).map(f => f.name);

    expect(names).toHaveLength(9);
    expect(names.at(-1)).toBe('plan_scale');
  });

  it('counts the lines that disagree', () => {
    const mixed = [
      line('document_no', 'Match'),
      line('issue_date', 'Mismatch', '1997-04-12', '1997-04-21'),
      line('plot_area', 'Mismatch', '0.12', '0.21'),
      line('decree_item', 'NotStated', null, 'ii'),
    ];

    expect(qrDisagreements(check('Differs', { fields: mixed }))).toBe(2);
    expect(qrDisagreements(check('Confirmed'))).toBe(0);
  });
});

describe('whether there is a table to draw', () => {
  it('draws one where the archive held the paper against its copy', () => {
    expect(comparesLines(check('Confirmed'))).toBe(true);
    expect(comparesLines(check('Differs'))).toBe(true);
  });

  // An empty table under "no record" reads as a table that failed to load. The
  // status and its sentence are the whole of what is known.
  it('draws none where nothing was compared', () => {
    expect(comparesLines(check('NotFound'))).toBe(false);
    expect(comparesLines(check('NoQrCode'))).toBe(false);
    expect(comparesLines(check('Confirmed', { fields: [] }))).toBe(false);
  });
});

describe('whether the issuing body could issue the paper', () => {
  it.each(['competent', 'incompetent', 'unknown'] as const)(
    'gives %s a tone and a word',
    standing => {
      expect(COMPETENCE_TONE[standing]).toBeDefined();
      expect(COMPETENCE_KEY[standing]).toBeDefined();
    },
  );

  it('reads the three answers off the contract', () => {
    expect(competence(check('Confirmed'))).toBe('competent');
    expect(
      competence(check('Differs', { issuingAuthorityCompetent: false })),
    ).toBe('incompetent');
    expect(competence(check('NotFound'))).toBe('unknown');
    expect(competence(check('NoQrCode'))).toBe('unknown');
  });

  // A paper can match the archive line for line and still have been issued by
  // a body with no power to issue it, which is the whole reason this is a fact
  // of its own rather than a ninth row of the table.
  it('is not read off the lines', () => {
    const matched = check('Differs', {
      fields: allEight('Match'),
      issuingAuthorityCompetent: false,
    });

    expect(qrDisagreements(matched)).toBe(0);
    expect(competence(matched)).toBe('incompetent');
    expect(qrSpeaksAgainst(matched)).toBe(true);
  });

  it('never draws "nothing to judge it by" as a fault', () => {
    expect(COMPETENCE_TONE.unknown).toBe('silent');
    expect(COMPETENCE_TONE.unknown).not.toBe(COMPETENCE_TONE.incompetent);
  });
});
