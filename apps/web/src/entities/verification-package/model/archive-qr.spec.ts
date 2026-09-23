import { describe, expect, it } from 'vitest';

import { DICTS, LOCALES } from '@/shared/i18n';
import {
  ArchiveQrCheckStatusSchema,
  ArchiveQrFieldNameSchema,
  ArchiveQrFieldVerdictSchema,
  type ArchiveQrCheckDto,
  type ArchiveQrCheckStatus,
  type ArchiveQrFieldCheckDto,
  type ArchiveQrFieldVerdict,
  type ArchiveQrSignatureDto,
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
  qrComparedFields,
  qrDisagreements,
  qrFields,
  qrSpeaksAgainst,
  qrUnstatedFields,
  SIGNATURE_KEY,
  SIGNATURE_LINE_KEY,
  SIGNATURE_LINE_ORDER,
  signatureLines,
  signatureStanding,
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

/** Everything the archive's signature panel can state, all of it present —
 *  the six values the disposal order's block is now expected to carry. */
const signed = (
  over: Partial<ArchiveQrSignatureDto> = {},
): ArchiveQrSignatureDto => ({
  signedBy: 'Məmmədov Anar',
  organisation: 'Azərbaycan Respublikası Milli Arxiv Fondu',
  unit: 'Sənədlərin rəqəmsallaşdırılması şöbəsi',
  signedOn: '2026-01-14T17:07:07.000+04:00',
  certificateValidity: '14.01.2025 — 14.01.2028',
  valid: true,
  ...over,
});

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

/**
 * Which of the eight the reader is shown (COMM-146).
 *
 * The engine answers all eight whatever the archive's copy holds, and six of
 * them coming back blank is the ordinary case rather than the exceptional one.
 * A row per question turns "the copy does not carry this line" into "the system
 * could not get this line", which is the reading the block exists to prevent.
 */
describe('which lines were actually compared', () => {
  const partial = () =>
    check('Differs', {
      fields: [
        line('document_no', 'Match', '1471', '1471'),
        line('issue_date', 'Mismatch', '12.04.1997', '21.04.1997'),
        line('issuing_authority', 'NotStated', 'Icra Hakimiyyati', null),
        line('holder_name', 'NotStated', 'Mammadov Anar', null),
      ],
    });

  it('keeps only the lines the archive answered on', () => {
    expect(qrComparedFields(partial()).map(f => f.name)).toEqual([
      'document_no',
      'issue_date',
    ]);
  });

  // Silence on the paper's side is not silence on the archive's: a line the
  // archive states and the document omits was answered, and it is where the
  // paper is short — the one comparison it would be worst to drop.
  it('keeps a line the paper omits and the archive states', () => {
    const shortPaper = check('Confirmed', {
      fields: [line('decree_item', 'NotStated', null, 'ii')],
    });

    expect(qrComparedFields(shortPaper).map(f => f.name)).toEqual([
      'decree_item',
    ]);
    expect(qrUnstatedFields(shortPaper)).toEqual([]);
  });

  it('names the rest, in the contract order, so the silence is not hidden', () => {
    expect(qrUnstatedFields(partial()).map(f => f.name)).toEqual([
      'issuing_authority',
      'holder_name',
    ]);
  });

  it('splits the eight between the two and loses none', () => {
    const all = check('Confirmed');

    expect(qrComparedFields(all)).toHaveLength(8);
    expect(qrUnstatedFields(all)).toEqual([]);
  });

  // The heading's count is what the reader sizes the check by. Out of all
  // eight, two disagreements among two compared lines would read as a paper
  // that mostly held.
  it('counts disagreements out of the lines that were compared', () => {
    const silent = check('Differs', {
      fields: [
        line('document_no', 'Mismatch', '1471', '1741'),
        line('issue_date', 'NotStated', '12.04.1997', null),
        line('plot_area', 'NotStated', '0.12', null),
      ],
    });

    expect(qrDisagreements(silent)).toBe(1);
    expect(qrComparedFields(silent)).toHaveLength(1);
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

  // Eight questions and eight silences is the same nothing as no questions at
  // all, and an empty frame under the status reads as a table that failed to
  // load. The sentence naming the eight is what the block shows instead.
  it('draws none where the archive answered on no line at all', () => {
    const silent = check('Confirmed', {
      fields: NAMES.map(name => line(name, 'NotStated', 'stated', null)),
    });

    expect(comparesLines(silent)).toBe(false);
    expect(qrUnstatedFields(silent)).toHaveLength(8);
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

/**
 * The signature panel the archive returns with the disposal order.
 *
 * Six values and not four: who signed, when, the organisation that issued the
 * signing certificate, the structural subdivision, how long that certificate
 * is valid, and whether the signature verified (COMM-141/COMM-142). The first
 * five are nullable on the contract and a block that drew five empty labels for
 * a source that stated none of them would be inventing an absence.
 */
describe('what the signature on the sheet states', () => {
  it('reads out every particular the archive stated, in one order', () => {
    const lines = signatureLines(check('Confirmed', { signature: signed() }));

    expect(lines.map(line => line.name)).toEqual([...SIGNATURE_LINE_ORDER]);
    expect(lines.map(line => line.value)).toEqual([
      'Məmmədov Anar',
      '2026-01-14T17:07:07.000+04:00',
      'Azərbaycan Respublikası Milli Arxiv Fondu',
      'Sənədlərin rəqəmsallaşdırılması şöbəsi',
      '14.01.2025 — 14.01.2028',
    ]);
  });

  it('carries the certificate validity period through as the source worded it', () => {
    const lines = signatureLines(
      check('Confirmed', {
        signature: signed({ certificateValidity: 'etibarlıdır 3 il' }),
      }),
    );

    expect(lines.find(line => line.name === 'certificateValidity')?.value).toBe(
      'etibarlıdır 3 il',
    );
  });

  // Each of the five is nullable, and a label with nothing under it states an
  // absence nobody claimed.
  it.each([...SIGNATURE_LINE_ORDER])('draws no line where %s is null', name => {
    const lines = signatureLines(
      check('Confirmed', { signature: signed({ [name]: null }) }),
    );

    expect(lines.map(line => line.name)).not.toContain(name);
    expect(lines).toHaveLength(SIGNATURE_LINE_ORDER.length - 1);
  });

  // Whitespace a service sent is not a particular the archive stated.
  it('treats a blank value as the silence it is', () => {
    expect(
      signatureLines(
        check('Confirmed', { signature: signed({ unit: '   ' }) }),
      ).map(line => line.name),
    ).not.toContain('unit');
  });

  // A signature can verify with nothing said about how it was made, and the
  // mark is then the whole of the answer — it must still be drawn.
  it('leaves the verified mark standing alone where nothing else is stated', () => {
    const bare = check('Confirmed', {
      signature: {
        signedBy: null,
        organisation: null,
        unit: null,
        signedOn: null,
        certificateValidity: null,
        valid: true,
      },
    });

    expect(signatureLines(bare)).toEqual([]);
    expect(signatureStanding(bare)).toBe('verified');
  });

  it('has nothing to read out where the archive verified no signature', () => {
    expect(signatureLines(check('Confirmed'))).toEqual([]);
    expect(signatureStanding(check('Confirmed'))).toBeNull();
  });

  /**
   * These keys reach `t` through a lookup and not as a literal, so
   * `keys-used.spec` — which scans the sources for `t('…')` — cannot see them.
   * A missing word would render as `detail.qr.cert_validity` beside a
   * signature, in all three languages, exactly as COMM-81 shipped.
   */
  it.each(LOCALES.map(l => l.id))('%s has a word for every line', locale => {
    const keys = [
      ...Object.values(SIGNATURE_LINE_KEY),
      ...Object.values(SIGNATURE_KEY),
      ...Object.values(QR_STATUS_KEY),
      ...Object.values(QR_STATUS_NOTE),
      ...Object.values(QR_VERDICT_KEY),
      ...Object.values(COMPETENCE_KEY),
    ];

    expect(keys.filter(key => !(key in DICTS[locale]))).toEqual([]);
  });

  // The five lines are filled in by the value and nothing else; a label that
  // lost its slot would print its wording with the value dropped.
  it.each(LOCALES.map(l => l.id))('%s leaves a slot for the value', locale => {
    const wordless = Object.values(SIGNATURE_LINE_KEY).filter(
      key => !DICTS[locale][key]?.includes('{value}'),
    );

    expect(wordless).toEqual([]);
  });
});

/**
 * The block answers for the National Archive and for nothing else (COMM-141).
 *
 * The register panel elsewhere in the view speaks of "the archive" too, so the
 * QR block's own words have to name which archive they mean — otherwise a
 * reader takes a National Archive verdict for our register's, which is the one
 * reading this change exists to make impossible.
 */
describe('which archive the block speaks for', () => {
  const NAMES_THE_ARCHIVE = [
    'detail.qr.confirmed',
    'detail.qr.differs',
    'detail.qr.in_archive',
    'detail.qr.confirmed_note',
    'detail.qr.differs_note',
    'detail.qr.not_found_note',
    'detail.qr.no_code_note',
    // The sentence naming the lines nobody compared says whose silence it is:
    // the register panel's archive is a different archive (COMM-146).
    'detail.qr.archive_states_none',
  ];

  it.each(LOCALES.map(l => l.id))(
    '%s never leaves the archive unnamed',
    locale => {
      const bare = NAMES_THE_ARCHIVE.filter(key => {
        const word = DICTS[locale][key] ?? '';

        return !/National Archive|Национальн|Milli Arxiv/i.test(word);
      });

      expect(bare).toEqual([]);
    },
  );
});
