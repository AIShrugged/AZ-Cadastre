import { describe, expect, it } from 'vitest';

import {
  HUMBETOV_ARCHIVE_LINES,
  READ_AS_FRAGMENTS,
} from '../../../test/humbetov-sheet.fixture.js';
import {
  ArchiveQrSignature,
  DocumentType,
  FieldKey,
  IssuingCompetence,
  VerificationProfile,
  type ArchiveQrField,
} from '../value-objects/index.js';

import {
  archiveQrCheckOf,
  isCheckedByItsQrCode,
  isHeldAgainstTheArchiveByQr,
  type ArchivedPaper,
} from './archive-qr-verdict.service.js';

const HOMESTEAD = DocumentType.create('homestead_land_allocation_decision');
const QR = 'https://qr.esd.milliarxiv.gov.az/F130-S1-I476-V98';
const CHECKED_AT = new Date('2026-09-16T12:00:00.000Z');

// The 1998 allotment order in the Rusadze package, as the paper prints it.
const ON_THE_PAPER: Record<ArchiveQrField, string> = {
  document_no: '1471',
  issue_date: '29.10.1998',
  issuing_authority: 'Sabunçu Rayon İcra Hakimiyyəti',
  holder_name: 'Qusadze Vera Vladimirovna',
  property_address:
    'Sabunçu rayonu, 1-ci Zabrat qəsəbəsindən yeni məhəlləyə gedən yolun solunda',
  plot_area: '400,0 kv.m',
  decree_item: '2.7',
  archive_reference: 'Fond-130, siy.1, i-476, vər.98',
};

// The archive's copy of the same order, in the archive's own spelling of each
// line: a different date format, the area in hectares, the fund written out.
function theArchivesCopy(
  lines: Partial<Record<ArchiveQrField, string | null>> = {},
  issuingAuthorityKind: ArchivedPaper['issuingAuthorityKind'] = 'LocalExecutiveAuthority',
): ArchivedPaper {
  return {
    lines: {
      document_no: '№ 1471',
      issue_date: '1998-10-29',
      issuing_authority: 'Bakı şəhəri Sabunçu Rayon İcra Hakimiyyəti',
      holder_name: 'QUSADZE VERA VLADIMIROVNA',
      property_address:
        'Bakı şəhəri, Sabunçu rayonu, 1-ci Zabrat qəsəbəsindən yeni ' +
        'məhəlləyə gedən yolun solunda',
      plot_area: '0,04 ha',
      decree_item: '2.7-ci bənd',
      archive_reference: 'Fond 130, siyahı 1, iş 476, vərəq 98',
      ...lines,
    },
    issuingAuthorityKind,
    // A holdings answer says nothing about the sheet's own signature: it is the
    // signature-verifying service that does, and this is not it (ADR-0034).
    signature: null,
  };
}

function check(
  archived: ArchivedPaper | null,
  options: {
    qrReference?: string | null;
    type?: DocumentType;
    paper?: Partial<Record<ArchiveQrField, string | null>>;
    unaskedIssuer?: string | null;
    issuerDidNotAnswer?: boolean;
  } = {},
) {
  const paper = { ...ON_THE_PAPER, ...options.paper };

  return archiveQrCheckOf({
    type: options.type ?? HOMESTEAD,
    stated: field => paper[field] ?? null,
    qrReference: options.qrReference === undefined ? QR : options.qrReference,
    archived,
    ...('unaskedIssuer' in options
      ? { unaskedIssuer: options.unaskedIssuer }
      : {}),
    ...('issuerDidNotAnswer' in options
      ? { issuerDidNotAnswer: options.issuerDidNotAnswer }
      : {}),
    checkedAt: CHECKED_AT,
  });
}

// The archive's copy states nothing about the sheet's own signature; a
// signature service states nothing but that (ADR-0034).
function aSignedSheet(valid: boolean): ArchivedPaper {
  return {
    lines: {
      document_no: null,
      issue_date: null,
      issuing_authority: null,
      holder_name: null,
      property_address: null,
      plot_area: null,
      decree_item: null,
      archive_reference: null,
    },
    // A signature service names the office that attested the copy and not the
    // body that issued the paper, so there is nobody here to judge.
    issuingAuthorityKind: null,
    signature: ArchiveQrSignature.of({
      signedBy: 'Məmmədov Anar',
      organisation: 'Milli Arxiv Fondu',
      unit: 'Bakı filialı',
      signedOn: '2026-01-14T09:12:00Z',
      valid,
    }),
  };
}

describe('holding a Decree 439 paper against the National Archive by its QR code', () => {
  describe('where the archive bears the paper out', () => {
    it('is confirmed on all eight lines, with the issuer competent', () => {
      const answer = check(theArchivesCopy());

      expect(answer.status).toBe('Confirmed');
      expect(answer.issuingAuthorityCompetent).toBe(true);
      expect(answer.qrReference).toBe(QR);
      expect(answer.checkedAt).toBe(CHECKED_AT);
      expect(answer.fields.map(field => [field.name, field.verdict])).toEqual([
        ['document_no', 'Match'],
        ['issue_date', 'Match'],
        ['issuing_authority', 'Match'],
        ['holder_name', 'Match'],
        ['property_address', 'Match'],
        ['plot_area', 'Match'],
        ['decree_item', 'Match'],
        ['archive_reference', 'Match'],
      ]);
    });

    // 400 square metres is 0.04 hectares however the paper writes it.
    it('converts the area before judging it', () => {
      const answer = check(theArchivesCopy({ plot_area: '4 sot' }));
      const area = answer.fields.find(field => field.name === 'plot_area');

      expect(area?.verdict).toBe('Match');
      expect(area?.documentValue).toBe('400,0 kv.m');
      expect(area?.archiveValue).toBe('4 sot');
    });

    it('keeps both sides of every line as they were stated', () => {
      const answer = check(theArchivesCopy());
      const date = answer.fields.find(field => field.name === 'issue_date');

      expect(date?.documentValue).toBe('29.10.1998');
      expect(date?.archiveValue).toBe('1998-10-29');
    });

    // Silence on either side is not a disagreement.
    it('takes a line one side does not state as not stated, and still confirms', () => {
      const answer = check(theArchivesCopy({ decree_item: null }), {
        paper: { plot_area: null },
      });

      expect(answer.status).toBe('Confirmed');
      expect(
        answer.fields
          .filter(field => field.verdict === 'NotStated')
          .map(field => field.name),
      ).toEqual(['plot_area', 'decree_item']);
    });
  });

  describe('where the archive differs', () => {
    it('differs on a line the copy states otherwise', () => {
      const answer = check(theArchivesCopy({ plot_area: '0,05 ha' }));

      expect(answer.status).toBe('Differs');
      expect(answer.issuingAuthorityCompetent).toBe(true);
      expect(answer.mismatched.map(field => field.name)).toEqual(['plot_area']);
    });

    it.each<[ArchiveQrField, string]>([
      ['document_no', '1741'],
      ['issue_date', '29.11.1998'],
      ['issuing_authority', 'Xəzər Rayon İcra Hakimiyyəti'],
      ['holder_name', 'Məmmədova Aynur Rəşid qızı'],
      ['property_address', 'Bakı şəhəri, Xəzər rayonu, Buzovna qəsəbəsi'],
      ['decree_item', '2.5-1'],
      ['archive_reference', 'Fond 130, siyahı 1, iş 476, vərəq 101'],
    ])('differs on %s', (name, archived) => {
      const answer = check(theArchivesCopy({ [name]: archived }));

      expect(answer.status).toBe('Differs');
      expect(answer.mismatched.map(field => field.name)).toEqual([name]);
    });

    // A matching name on an act its issuer had no power to make is an act that
    // confirms nothing: the check is a fact of its own, not the string.
    it('differs where the body the archive files the paper under could not issue a paper of this kind', () => {
      const answer = check(theArchivesCopy({}, 'CollectiveFarm'));

      expect(answer.status).toBe('Differs');
      expect(answer.issuingAuthorityCompetent).toBe(false);
      expect(answer.mismatched).toEqual([]);
    });

    it('judges competence by the kind of paper the document was read as', () => {
      const answer = check(theArchivesCopy(), {
        type: DocumentType.create('technical_passport'),
      });

      expect(answer.status).toBe('Differs');
      expect(answer.issuingAuthorityCompetent).toBe(false);
    });
  });

  describe('where there is no answer to compare', () => {
    it('is not found where the archive holds nothing under the reference', () => {
      const answer = check(null);

      expect(answer.status).toBe('NotFound');
      expect(answer.qrReference).toBe(QR);
      expect(answer.issuingAuthorityCompetent).toBeNull();
      expect(answer.fields).toEqual([]);
    });

    it.each([null, '', '   '])(
      'has no QR code where none was read off the paper (%j)',
      qrReference => {
        const answer = check(theArchivesCopy(), { qrReference });

        expect(answer.status).toBe('NoQrCode');
        expect(answer.qrReference).toBeNull();
        expect(answer.issuingAuthorityCompetent).toBeNull();
        expect(answer.fields).toEqual([]);
      },
    );
  });
});

describe('which papers are held against the National Archive by their QR code', () => {
  const profile = VerificationProfile.CADASTRE;

  it('holds every Decree 439 title the profile reads for its QR code', () => {
    const held = profile.specs
      .filter(spec => isHeldAgainstTheArchiveByQr(spec))
      .map(spec => spec.type.value);

    expect(held).toEqual([
      'land_right_state_act',
      'soviet_land_record',
      'land_allocation_decision',
      'notarised_land_allocation_contract',
      'household_book_extract',
      'technical_passport',
      'kolkhoz_allocation_decision',
      'bound_land_book_extract',
      'sovkhoz_allocation_order',
      'homestead_land_allocation_decision',
      'apartment_demolition_decision',
    ]);
  });

  /*
   * The extract from the disposal order, and nothing else (ADR-0035).
   *
   * ADR-0034 resolved the code on any paper that printed one; the customer
   * wants one paper checked, and this is the assertion that says which.
   */
  it('resolves the disposal order and no other type', () => {
    const resolved = profile.specs
      .filter(spec => isCheckedByItsQrCode(spec))
      .map(spec => spec.type.value);

    expect(resolved).toEqual(['disposal_order']);
  });

  /*
   * The papers ADR-0034 had widened the check to, each of which printed a code
   * and each of which is now back to what it said before its code was resolved
   * — a register extract and a plan of the plot state nothing about the
   * archive, and an archive certificate is `IntegrationNotConnected` again.
   */
  it('resolves neither the archive certificate, the register extract nor the plan', () => {
    for (const type of [
      'archive_certificate',
      'state_register_extract',
      'land_plot_plan',
    ]) {
      const spec = profile.specFor(DocumentType.create(type));

      expect(spec.schema.declares(FieldKey.create('qr_code'))).toBe(true);
      expect(isCheckedByItsQrCode(spec)).toBe(false);
    }
  });

  /*
   * Still true of the certificate, and it is no longer the same question as
   * the one above: what a Decree 439 comparison is *about* is one thing, and
   * which paper has its code resolved is another (ADR-0035).
   */
  it('holds the archive certificate against no eight lines', () => {
    const certificate = profile.specFor(
      DocumentType.create('archive_certificate'),
    );

    expect(certificate.source).toBe('NationalArchive');
    expect(isHeldAgainstTheArchiveByQr(certificate)).toBe(false);
  });

  // A paper the table forgot would silently fall back to "not connected"; one
  // the table names and the profile does not hold would be a rule nobody runs.
  it('settles the competence of exactly the papers it holds', () => {
    const held = profile.specs
      .filter(spec => isHeldAgainstTheArchiveByQr(spec))
      .map(spec => spec.type.value);

    expect(IssuingCompetence.types.map(type => type.value).toSorted()).toEqual(
      held.toSorted(),
    );
  });
});

/*
 * The answers that are not the archive's copy of a paper (ADR-0034).
 *
 * Every one of them is an absence, and the point of each is that it is a
 * *different* absence: the reader found no code, the issuer is somebody this
 * system cannot ask, the archive looked and holds nothing, the archive answered
 * about the sheet and not about what it says.
 */
describe('resolving a QR code that is not the archive holding a copy', () => {
  it('says the issuer was never asked, and names it', () => {
    const answer = check(null, { unaskedIssuer: 'e-emlak.gov.az' });

    expect(answer.status).toBe('IssuerNotConnected');
    expect(answer.issuer).toBe('e-emlak.gov.az');
    expect(answer.qrReference).toBe(QR);
    expect(answer.isUnanswered).toBe(true);
    expect(answer.differs).toBe(false);
  });

  // A payload that is not a link names nobody, and nothing may be guessed.
  it('names no issuer where the reference names none', () => {
    expect(check(null, { unaskedIssuer: null }).issuer).toBeNull();
  });

  /*
   * Asked, and nobody answered (ADR-0037, COMM-144).
   *
   * A different absence from every other one here, and the one that used to be
   * no answer at all: the stage threw, no check was written, and a document
   * with no check on it reads on the page as a paper the check does not apply
   * to. Never `NotFound` — the archive did not look, so it holds nothing
   * against this paper and says nothing about it either.
   */
  it('says the issuer was asked and did not answer, and names it', () => {
    const answer = check(null, { issuerDidNotAnswer: true });

    expect(answer.status).toBe('IssuerUnreachable');
    expect(answer.issuer).toBe('qr.esd.milliarxiv.gov.az');
    expect(answer.qrReference).toBe(QR);
    expect(answer.isUnanswered).toBe(true);
    expect(answer.differs).toBe(false);
    expect(answer.isConfirmed).toBe(false);
    expect(answer.fields).toEqual([]);
  });

  // No code read off the paper is still nothing to ask with, whatever the
  // archive would have done with it.
  it('stays "no code" where there was nothing to ask by', () => {
    expect(
      check(null, { qrReference: null, issuerDidNotAnswer: true }).status,
    ).toBe('NoQrCode');
  });

  /*
   * The one verdict this check must never produce: a paper confirmed by an
   * entry that says nothing about it. Eight `NotStated` lines are not "nothing
   * disagrees" — from the caller's side they are an empty shelf, and they are
   * told the same way.
   */
  it('reads an answer that states nothing at all as nothing found', () => {
    const empty: ArchivedPaper = {
      ...aSignedSheet(true),
      signature: null,
    };

    expect(check(empty).status).toBe('NotFound');
  });

  it('confirms a sheet whose signature the issuer verified, and keeps who signed it', () => {
    const answer = check(aSignedSheet(true));

    expect(answer.status).toBe('Confirmed');
    expect(answer.signature?.signedBy).toBe('Məmmədov Anar');
    expect(answer.fields.every(field => field.verdict === 'NotStated')).toBe(
      true,
    );
  });

  // Stronger than any single line: the lines are what the paper says, and this
  // is whether the paper is the paper.
  it('holds a sheet whose signature did not verify against the package', () => {
    const answer = check(aSignedSheet(false));

    expect(answer.status).toBe('Differs');
    expect(answer.differs).toBe(true);
  });

  /*
   * The regression COMM-145 was raised for, on the case it was raised on.
   *
   * The reader of the archive's copy answered with the tails of four sentences
   * it had cut a label out of the middle of, and two of them were reported to
   * the inspector as the archive contradicting the paper — on a package whose
   * every line agrees with the archive's. The reader is fixed; this is the
   * guard that a future misreading cannot cost the same thing, because the
   * price is the worst this check can pay: an inspector told that the archive
   * denies a valid paper stops looking at it.
   */
  it('never reads a fragment of prose as the archive denying a line', () => {
    const answer = check(
      theArchivesCopy({ ...HUMBETOV_ARCHIVE_LINES, ...READ_AS_FRAGMENTS }),
      { paper: HUMBETOV_ARCHIVE_LINES },
    );

    const verdicts = Object.fromEntries(
      answer.fields.map(field => [field.name, field.verdict]),
    );

    expect(verdicts.property_address).toBe('NotStated');
    expect(verdicts.plot_area).toBe('NotStated');
    expect(verdicts.decree_item).toBe('NotStated');
    expect(verdicts.archive_reference).toBe('NotStated');
    expect(answer.differs).toBe(false);
  });

  /*
   * And the same package read properly: the Hümbətov sheet states six of the
   * eight lines and prints no item of Decree 439, so the answer is agreement on
   * the six and silence on the rest — never a disagreement (COMM-145).
   */
  it('confirms the paper the archive prints, line for line', () => {
    const answer = check(theArchivesCopy(HUMBETOV_ARCHIVE_LINES), {
      paper: HUMBETOV_ARCHIVE_LINES,
    });

    const verdicts = Object.fromEntries(
      answer.fields.map(field => [field.name, field.verdict]),
    );

    expect(verdicts).toEqual({
      document_no: 'Match',
      issue_date: 'Match',
      issuing_authority: 'Match',
      holder_name: 'Match',
      property_address: 'Match',
      plot_area: 'Match',
      decree_item: 'NotStated',
      archive_reference: 'Match',
    });
    expect(answer.status).toBe('Confirmed');
  });

  /*
   * Competence is a question the Decree answers about eleven types and about no
   * other. Answering `false` for want of a row would turn "no rule" into "no
   * power", and every register extract would read as issued by a body with no
   * authority to issue it.
   */
  it('leaves competence unjudged for a paper the Decree says nothing about', () => {
    const answer = check(aSignedSheet(true), {
      type: DocumentType.create('state_register_extract'),
    });

    expect(answer.issuingAuthorityCompetent).toBeNull();
    expect(answer.status).toBe('Confirmed');
  });
});
