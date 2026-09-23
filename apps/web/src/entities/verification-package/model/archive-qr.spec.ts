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
  competence,
  COMPETENCE_KEY,
  COMPETENCE_TONE,
  competenceKey,
  QR_FIELD_ORDER,
  QR_OUTCOME_KEY,
  QR_OUTCOME_TONE,
  QR_STATUS_KEY,
  QR_STATUS_NOTE,
  QR_STATUS_TONE,
  qrComparedFields,
  qrConfirmsNoLine,
  qrDisagreements,
  qrDrawsTable,
  qrFieldOutcome,
  qrFields,
  qrSpeaksAgainst,
  qrStatusKey,
  qrStatusNote,
  qrStatusTone,
  qrUncomparedFields,
  qrUnreadFields,
  qrUnstatedFields,
  SIGNATURE_KEY,
  SIGNATURE_ROW_KEY,
  SIGNATURE_ROW_ORDER,
  signatureRows,
  signatureStanding,
} from './archive-qr';

const STATUSES = ArchiveQrCheckStatusSchema.options;
const VERDICTS = ArchiveQrFieldVerdictSchema.options;
const NAMES = ArchiveQrFieldNameSchema.options;
const OUTCOMES = [
  'match',
  'mismatch',
  'archive_silent',
  'document_silent',
  'not_compared',
  'copy_unread',
] as const;

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

  it.each(OUTCOMES)('gives %s a tone and a word', outcome => {
    expect(QR_OUTCOME_TONE[outcome]).toBeDefined();
    expect(QR_OUTCOME_KEY[outcome]).toBeDefined();
  });

  // The contract may gain a verdict, and the result column is the whole of what
  // a row says: an outcome this build cannot name would leave the cell blank.
  it.each(VERDICTS)('reads %s into an outcome the table can print', verdict => {
    const outcome = qrFieldOutcome(line('document_no', verdict));

    expect(OUTCOMES).toContain(outcome);
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
    expect(QR_OUTCOME_TONE.archive_silent).toBe('silent');
    expect(QR_OUTCOME_TONE.document_silent).toBe('silent');
    expect(QR_OUTCOME_TONE.not_compared).toBe('silent');
    expect(QR_OUTCOME_TONE.archive_silent).not.toBe(QR_OUTCOME_TONE.mismatch);
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
 * Every one of them is a row of the table since COMM-150 — what changes is the
 * word in its result column, and these three selections are what the count, the
 * summary and the issuing body's standing are read off.
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

  /*
   * Both end with no archive value and they are not the same news: one is a
   * file that carries no such line, the other is this system declining to put
   * the question (ADR-0040). Told in one sentence the reader blames the fonds
   * for a rule of ours.
   */
  it('keeps a line nobody asked about out of the archive\u2019s silences', () => {
    const decided = check('Differs', {
      fields: [
        line('document_no', 'Match', '1471', '1471'),
        line('issuing_authority', 'NotCompared', 'Icra Hakimiyyati', null),
        line('holder_name', 'NotStated', 'Mammadov Anar', null),
      ],
    });

    expect(qrUnstatedFields(decided).map(f => f.name)).toEqual(['holder_name']);
    expect(qrUncomparedFields(decided).map(f => f.name)).toEqual([
      'issuing_authority',
    ]);
  });

  // Read off the verdict and not off the missing value: an uncompared line is
  // told from an unanswered one by the word the contract sends and by nothing
  // else, since both come back with a null.
  it('reads the decision off the verdict and not off the empty value', () => {
    const silent = check('Confirmed', {
      fields: [
        line('issuing_authority', 'NotStated', 'Icra Hakimiyyati', null),
      ],
    });

    expect(qrUncomparedFields(silent)).toEqual([]);
    expect(qrUnstatedFields(silent).map(f => f.name)).toEqual([
      'issuing_authority',
    ]);
  });

  // A line never put to the archive is no part of the comparison and no part of
  // the count — it has a row like every other line, saying so.
  it('counts no difference for a line nobody asked about', () => {
    const decided = check('Confirmed', {
      fields: [
        line('document_no', 'Match', '1471', '1471'),
        line('issuing_authority', 'NotCompared', 'Icra Hakimiyyati', null),
      ],
    });

    expect(qrComparedFields(decided).map(f => f.name)).toEqual(['document_no']);
    expect(qrDisagreements(decided)).toBe(0);
  });

  it('holds the three selections apart and loses no line between them', () => {
    const mixed = check('Differs', {
      fields: NAMES.map((name, at) =>
        at === 0
          ? line(name, 'NotCompared', 'stated', null)
          : at === 1
            ? line(name, 'NotStated', 'stated', null)
            : line(name, 'Match'),
      ),
    });

    expect(
      qrComparedFields(mixed).length +
        qrUnstatedFields(mixed).length +
        qrUncomparedFields(mixed).length,
    ).toBe(NAMES.length);
    expect(qrUncomparedFields(mixed)).toHaveLength(1);
    expect(qrUnstatedFields(mixed)).toHaveLength(1);
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

/**
 * What the `Результат` column says, row by row (COMM-150).
 *
 * The customer opened a package whose eight lines all came back empty and read
 * five paragraphs of prose with the field names inside the sentences. The four
 * facts those paragraphs carried — agreed, differed, the archive prints no such
 * line, we never put the question — are one word per row now, and the fifth is
 * the one the four leave out.
 */
describe('what each row says it came to', () => {
  it('reads the two real comparisons off the verdict', () => {
    expect(qrFieldOutcome(line('document_no', 'Match', '1471', '1471'))).toBe(
      'match',
    );
    expect(
      qrFieldOutcome(line('issue_date', 'Mismatch', '12.04', '21.04')),
    ).toBe('mismatch');
  });

  /*
   * The whole of the customer's screenshot: eight questions, eight blanks from
   * the archive. Told as "не указано" it reads as a shortfall of the paper's;
   * told as "архив не приводит" it says whose silence it actually is.
   */
  it('names the archive as the silent side where its copy prints nothing', () => {
    expect(
      qrFieldOutcome(line('holder_name', 'NotStated', 'Mammadov Anar', null)),
    ).toBe('archive_silent');
  });

  // The other side of the same verdict, and the opposite news: the archive does
  // carry the line and the paper does not. Folded into the archive's silence it
  // would say the reverse of what happened.
  it('names the paper as the silent side where the archive states the line', () => {
    expect(qrFieldOutcome(line('decree_item', 'NotStated', null, 'ii'))).toBe(
      'document_silent',
    );
  });

  // A decision of ours and never the fonds', which is why it is read off the
  // verdict: both come back with a null archive value (ADR-0040).
  it('keeps our own decision apart from the archive keeping quiet', () => {
    const ours = qrFieldOutcome(
      line('issuing_authority', 'NotCompared', 'Icra Hakimiyyati', null),
    );

    expect(ours).toBe('not_compared');
    expect(ours).not.toBe('archive_silent');
  });

  /*
   * And a failure of ours apart from both (ADR-0041).
   *
   * This is the customer's screenshot read correctly. The archive answered and
   * served its own signed copy of the paper; we could not read it, and the row
   * said «архив не приводит» — the fonds blamed for what this system did
   * (COMM-151).
   */
  it('keeps a copy we could not read apart from the archive keeping quiet', () => {
    const ours = qrFieldOutcome(line('document_no', 'NotRead', '100', null));

    expect(ours).toBe('copy_unread');
    expect(ours).not.toBe('archive_silent');
    expect(
      qrUnreadFields(
        check('Confirmed', {
          fields: [line('document_no', 'NotRead', '100', null)],
        }),
      ).map(field => field.name),
    ).toEqual(['document_no']);
  });

  // The three absences are three lists, and a line belongs to exactly one.
  it('sorts the three absences into three lists', () => {
    const mixed = check('Confirmed', {
      fields: [
        line('document_no', 'NotRead', '100', null),
        line('issuing_authority', 'NotCompared', 'Icra Hakimiyyati', null),
        line('holder_name', 'NotStated', 'Mammadov Anar', null),
      ],
    });

    expect(qrUnreadFields(mixed).map(f => f.name)).toEqual(['document_no']);
    expect(qrUncomparedFields(mixed).map(f => f.name)).toEqual([
      'issuing_authority',
    ]);
    expect(qrUnstatedFields(mixed).map(f => f.name)).toEqual(['holder_name']);
  });

  it('gives only a disagreement a fault\u2019s colour', () => {
    expect(QR_OUTCOME_TONE.mismatch).toBe('issues');
    expect(QR_OUTCOME_TONE.match).toBe('ok');
  });

  // Five words and five distinct ones: two outcomes sharing a word would put
  // the reader back where the prose left them.
  it('gives each outcome a word of its own', () => {
    const words = Object.values(QR_OUTCOME_KEY);

    expect(new Set(words).size).toBe(words.length);
  });
});

describe('whether there is a table to draw', () => {
  it('draws one wherever the check carries lines at all', () => {
    expect(qrDrawsTable(check('Confirmed'))).toBe(true);
    expect(qrDrawsTable(check('Differs'))).toBe(true);
  });

  /*
   * The change COMM-150 is: the table no longer waits for the archive to have
   * answered something. Eight questions and eight silences used to hide it and
   * report themselves in prose, which is how a check that compared nothing came
   * to summarise as "все сверенные строки совпали". Nothing was compared is now
   * what the table says, row by row.
   */
  it('draws one where the archive answered on no line at all', () => {
    const silent = check('Confirmed', {
      fields: NAMES.map(name => line(name, 'NotStated', 'stated', null)),
    });

    expect(qrDrawsTable(silent)).toBe(true);
    expect(qrFields(silent)).toHaveLength(8);
    expect(qrComparedFields(silent)).toEqual([]);
  });

  // An empty table under "no record" still reads as a table that failed to
  // load. Those statuses carry no lines at all, and the status and its sentence
  // remain the whole of what is known.
  it('draws none where the check carries no line', () => {
    expect(qrDrawsTable(check('NotFound'))).toBe(false);
    expect(qrDrawsTable(check('NoQrCode'))).toBe(false);
    expect(qrDrawsTable(check('IssuerNotConnected'))).toBe(false);
    expect(qrDrawsTable(check('Confirmed', { fields: [] }))).toBe(false);
  });

  // Every line the check carries gets a row — the eight, and a ninth the wire
  // may learn to send. Nothing is dropped for having no answer.
  it('gives every line the check carries a row', () => {
    const mixed = check('Confirmed', {
      fields: NAMES.map((name, at) =>
        at === 0
          ? line(name, 'NotCompared', 'stated', null)
          : at < 4
            ? line(name, 'NotStated', 'stated', null)
            : line(name, 'Match'),
      ),
    });

    expect(qrFields(mixed)).toHaveLength(8);
    expect(qrFields(mixed).map(qrFieldOutcome)).toEqual([
      'not_compared',
      'archive_silent',
      'archive_silent',
      'archive_silent',
      'match',
      'match',
      'match',
      'match',
    ]);
  });
});

/**
 * The summary must not claim a confirmation nobody made (COMM-150).
 *
 * The customer's package: the archive answered, its copy stated none of the
 * eight lines, and the block headed itself «Копия Национального архива
 * подтверждает» over a sentence saying every compared line agreed. Both true
 * over an empty set, and both read by an inspector as a confirmed paper.
 */
describe('a confirmation with nothing in it', () => {
  const vacuous = () =>
    check('Confirmed', {
      signature: signed(),
      fields: NAMES.map(name =>
        name === 'issuing_authority'
          ? line(name, 'NotCompared', 'Icra Hakimiyyati', null)
          : line(name, 'NotStated', 'stated', null),
      ),
    });

  it('sees that not one line was borne out', () => {
    expect(qrConfirmsNoLine(vacuous())).toBe(true);
    expect(qrComparedFields(vacuous())).toEqual([]);
  });

  it('says so in its own word and its own sentence', () => {
    expect(qrStatusKey(vacuous())).toBe('detail.qr.confirmed_no_line');
    expect(qrStatusNote(vacuous())).toBe('detail.qr.confirmed_no_line_note');
    expect(qrStatusKey(vacuous())).not.toBe(QR_STATUS_KEY.Confirmed);
    expect(qrStatusNote(vacuous())).not.toBe(QR_STATUS_NOTE.Confirmed);
  });

  // A green pill over an answer with nothing in it is the whole of the
  // misreading, and the pill is the one part of the block a folded case shows.
  it('does not colour it as a pass', () => {
    expect(qrStatusTone(vacuous())).toBe('silent');
    expect(qrStatusTone(vacuous())).not.toBe(QR_STATUS_TONE.Confirmed);
  });

  // The word an inspector reads must not be one of the confirming ones, in any
  // of the three languages.
  it.each(LOCALES.map(l => l.id))('%s never says it was confirmed', locale => {
    const dict = DICTS[locale];

    expect(dict[qrStatusKey(vacuous())]).toBeTruthy();
    expect(dict[qrStatusKey(vacuous())]).not.toBe(
      dict[QR_STATUS_KEY.Confirmed],
    );
    expect(dict[qrStatusNote(vacuous())]).not.toBe(
      dict[QR_STATUS_NOTE.Confirmed],
    );
  });

  // A real confirmation is untouched: one line held against the copy and agreed
  // is a confirmation, and the block keeps saying so.
  it('leaves a confirmation that bore a line out alone', () => {
    const real = check('Confirmed', {
      fields: [line('document_no', 'Match', '1471', '1471')],
    });

    expect(qrConfirmsNoLine(real)).toBe(false);
    expect(qrStatusKey(real)).toBe(QR_STATUS_KEY.Confirmed);
    expect(qrStatusTone(real)).toBe('ok');
  });

  /*
   * Only `Confirmed`. `Differs` with no compared line is a finding of another
   * kind — the signature did not verify, or the issuing body had no such power
   * — and its word and its fault's colour are already the right ones. The four
   * silences never claimed anything to begin with.
   */
  it('leaves every other status to its own word', () => {
    const differs = check('Differs', {
      fields: NAMES.map(name => line(name, 'NotStated', 'stated', null)),
      issuingAuthorityCompetent: false,
    });

    expect(qrConfirmsNoLine(differs)).toBe(false);
    expect(qrStatusKey(differs)).toBe(QR_STATUS_KEY.Differs);
    expect(qrStatusTone(differs)).toBe('issues');
    expect(qrStatusKey(check('NotFound'))).toBe(QR_STATUS_KEY.NotFound);
    expect(qrStatusTone(check('NoQrCode'))).toBe('silent');
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

  /*
   * "Nothing to judge its power by" standing alone invites the guess that the
   * archive was asked about the body and shrugged. Where the line was never
   * put to it, that is why the standing is empty, and the block says so rather
   * than leaving the two lines to be joined up by the reader (COMM-149).
   */
  it('says why there is nothing to judge by where the line is never put', () => {
    const decided = check('Confirmed', {
      issuingAuthorityCompetent: null,
      fields: [
        line('document_no', 'Match', '1471', '1471'),
        line('issuing_authority', 'NotCompared', 'Icra Hakimiyyati', null),
      ],
    });

    expect(competenceKey(decided)).toBe('detail.qr.competence_not_compared');
  });

  // Only where the line is in fact uncompared: a type the Decree's table does
  // not settle has nothing to blame this system's rule for.
  it('keeps the plain wording where the line was compared', () => {
    const asked = check('Confirmed', {
      issuingAuthorityCompetent: null,
      fields: [
        line('issuing_authority', 'NotStated', 'Icra Hakimiyyati', null),
      ],
    });

    expect(competenceKey(asked)).toBe(COMPETENCE_KEY.unknown);
    expect(competenceKey(check('NotFound'))).toBe(COMPETENCE_KEY.unknown);
  });

  // A standing the archive did answer needs no excuse, whatever the lines did.
  it('answers with the standing itself wherever there is one', () => {
    const decided = check('Confirmed', {
      issuingAuthorityCompetent: true,
      fields: [
        line('issuing_authority', 'NotCompared', 'Icra Hakimiyyati', null),
      ],
    });

    expect(competenceKey(decided)).toBe(COMPETENCE_KEY.competent);
    expect(
      competenceKey(check('Differs', { issuingAuthorityCompetent: false })),
    ).toBe(COMPETENCE_KEY.incompetent);
  });

  it.each(LOCALES.map(l => l.id))('%s has a word for that reason', locale => {
    expect(DICTS[locale]['detail.qr.competence_not_compared']).toBeTruthy();
  });
});

/**
 * The signature table the archive returns with the disposal order.
 *
 * Six rows and always six (COMM-150): who signed, when, the organisation that
 * issued the signing certificate, the structural subdivision, how long that
 * certificate is valid, and whether the signature verified. The first five are
 * nullable on the contract and the block used to drop a null one silently — so
 * a service stating two of the five drew two lines, and the reader could not
 * tell a value the archive withheld from a field this build does not read. The
 * customer's ask was exactly that distinction: which fields, and which of them
 * we have.
 */
describe('what the signature on the sheet states', () => {
  const rows = (over: Partial<ArchiveQrSignatureDto> = {}) =>
    signatureRows(check('Confirmed', { signature: signed(over) }));

  it('reads out every particular the archive stated, in one order', () => {
    expect(rows().map(row => row.name)).toEqual([...SIGNATURE_ROW_ORDER]);
    expect(rows().map(row => row.value)).toEqual([
      'Məmmədov Anar',
      '2026-01-14T17:07:07.000+04:00',
      'Azərbaycan Respublikası Milli Arxiv Fondu',
      'Sənədlərin rəqəmsallaşdırılması şöbəsi',
      '14.01.2025 — 14.01.2028',
      // The standing is a mark and a word, never a string the service sent.
      null,
    ]);
  });

  it('carries the certificate validity period through as the source worded it', () => {
    expect(
      rows({ certificateValidity: 'etibarlıdır 3 il' }).find(
        row => row.name === 'certificateValidity',
      )?.value,
    ).toBe('etibarlıdır 3 il');
  });

  /*
   * The behaviour COMM-150 reverses. Each of the five is nullable, and the row
   * used to disappear with its value — which hid the shape of the block from
   * the one reader who needs it: an inspector asking which fields the archive
   * answers at all. The row stays, and the table draws its placeholder.
   */
  it.each([
    'signedBy',
    'signedOn',
    'organisation',
    'unit',
    'certificateValidity',
  ] as const)('keeps the row and empties the value where %s is null', name => {
    const drawn = rows({ [name]: null });

    expect(drawn.map(row => row.name)).toEqual([...SIGNATURE_ROW_ORDER]);
    expect(drawn.find(row => row.name === name)?.value).toBeNull();
  });

  /*
   * The live service answers the subdivision as the full path through the
   * organisation, and the organisation is on the row above (COMM-149). Drawn
   * in full, the second row buries the branch and the post it exists to say
   * behind a name just read.
   */
  it('drops the organisation the subdivision repeats', () => {
    const org = 'Az\u0259rbaycan Respublikas\u0131 Milli Arxiv Fondu';
    const drawn = rows({
      organisation: org,
      unit: `${org} / D\u00d6VL\u018fT ARX\u0130V\u0130N\u0130N BAKI F\u0130LIALI D\u0130REKTOR`,
    });

    expect(drawn.find(r => r.name === 'organisation')?.value).toBe(org);
    expect(drawn.find(r => r.name === 'unit')?.value).toBe(
      'D\u00d6VL\u018fT ARX\u0130V\u0130N\u0130N BAKI F\u0130LIALI D\u0130REKTOR',
    );
  });

  // Only a prefix. A subdivision that names the organisation further in is not
  // a path through it, and cutting there would take words out of the middle.
  it('keeps both rows whole where the subdivision is not a path', () => {
    expect(
      rows({
        organisation: 'Milli Arxiv Fondu',
        unit: 'R\u0259q\u0259msalla\u015fd\u0131rma \u015f\u00f6b\u0259si, Milli Arxiv Fondu',
      }).find(r => r.name === 'unit')?.value,
    ).toBe(
      'R\u0259q\u0259msalla\u015fd\u0131rma \u015f\u00f6b\u0259si, Milli Arxiv Fondu',
    );
  });

  // With the prefix gone there is nothing left in the value: it would say only
  // what the row above already said. The row stays and the value empties.
  it('empties the subdivision where it is the organisation and nothing more', () => {
    const org = 'Milli Arxiv Fondu';
    const drawn = rows({ organisation: org, unit: org });

    expect(drawn.map(r => r.name)).toContain('unit');
    expect(drawn.find(r => r.name === 'unit')?.value).toBeNull();
  });

  // Nothing above to repeat: the subdivision is then the only name the block
  // has and it is drawn as the service sent it.
  it('keeps the subdivision whole where no organisation was stated', () => {
    expect(
      rows({
        organisation: null,
        unit: 'Milli Arxiv Fondu / BAKI F\u0130LIALI',
      }).find(r => r.name === 'unit')?.value,
    ).toBe('Milli Arxiv Fondu / BAKI F\u0130LIALI');
  });

  // Whitespace a service sent is not a particular the archive stated.
  it('treats a blank value as the silence it is', () => {
    expect(
      rows({ unit: '   ' }).find(r => r.name === 'unit')?.value,
    ).toBeNull();
  });

  // A signature can verify with nothing said about how it was made. The table
  // is still six rows — five placeholders and the standing — because "we asked
  // and the archive states none of this" is itself the answer.
  it('draws all six where the archive stated nothing but the standing', () => {
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

    expect(signatureRows(bare).map(r => r.name)).toEqual([
      ...SIGNATURE_ROW_ORDER,
    ]);
    expect(signatureRows(bare).every(r => r.value === null)).toBe(true);
    expect(signatureStanding(bare)).toBe('verified');
  });

  // And no table at all where the archive verified no signature: six labels
  // over six placeholders would state the absence of a thing never claimed.
  it('has nothing to draw where the archive verified no signature', () => {
    expect(signatureRows(check('Confirmed'))).toEqual([]);
    expect(signatureStanding(check('Confirmed'))).toBeNull();
  });

  /**
   * These keys reach `t` through a lookup and not as a literal, so
   * `keys-used.spec` — which scans the sources for `t('…')` — cannot see them.
   * A missing word would render as `detail.qr.cert_validity` beside a
   * signature, in all three languages, exactly as COMM-81 shipped.
   */
  it.each(LOCALES.map(l => l.id))('%s has a word for every row', locale => {
    const keys = [
      ...Object.values(SIGNATURE_ROW_KEY),
      ...Object.values(SIGNATURE_KEY),
      ...Object.values(QR_STATUS_KEY),
      ...Object.values(QR_STATUS_NOTE),
      ...Object.values(QR_OUTCOME_KEY),
      ...Object.values(COMPETENCE_KEY),
      'detail.qr.confirmed_no_line',
      'detail.qr.confirmed_no_line_note',
    ];

    expect(keys.filter(key => !(key in DICTS[locale]))).toEqual([]);
  });

  /*
   * The labels are labels now and the value sits in its own column, so a
   * `{value}` slot left in one would print the placeholder at the reader —
   * `Копию подписал {value}` beside the name it was meant to carry (COMM-150).
   */
  it.each(LOCALES.map(l => l.id))(
    '%s leaves no value slot in a label',
    locale => {
      const withSlot = [
        ...Object.values(SIGNATURE_ROW_KEY),
        'detail.qr.competence',
      ].filter(key => DICTS[locale][key]?.includes('{'));

      expect(withSlot).toEqual([]);
    },
  );

  // The prose the table replaces is gone from every dictionary, not merely
  // unreferenced by the component.
  it.each(LOCALES.map(l => l.id))(
    '%s has no orphaned sentence left',
    locale => {
      const gone = [
        'detail.qr.archive_states_none',
        'detail.qr.archive_not_compared',
        'detail.qr.silent',
        'detail.qr.v_match',
        'detail.qr.v_mismatch',
        'detail.qr.v_not_stated',
        'detail.qr.v_not_compared',
      ].filter(key => key in DICTS[locale]);

      expect(gone).toEqual([]);
    },
  );
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
    // The sentence a confirmation with nothing in it is told by, which says
    // what the archive did and did not do (COMM-150).
    'detail.qr.confirmed_no_line_note',
    // And the signature table, which is about a file the National Archive
    // released and not about the paper it copies (COMM-149).
    'detail.qr.signature',
    'detail.qr.signature_note',
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
