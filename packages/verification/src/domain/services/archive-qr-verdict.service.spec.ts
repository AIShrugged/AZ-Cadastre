import { describe, expect, it } from 'vitest';

import {
  DocumentType,
  IssuingCompetence,
  VerificationProfile,
  type ArchiveQrField,
} from '../value-objects/index.js';

import {
  archiveQrCheckOf,
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
  };
}

function check(
  archived: ArchivedPaper | null,
  options: {
    qrReference?: string | null;
    type?: DocumentType;
    paper?: Partial<Record<ArchiveQrField, string | null>>;
  } = {},
) {
  const paper = { ...ON_THE_PAPER, ...options.paper };

  return archiveQrCheckOf({
    type: options.type ?? HOMESTEAD,
    stated: field => paper[field] ?? null,
    qrReference: options.qrReference === undefined ? QR : options.qrReference,
    archived,
    checkedAt: CHECKED_AT,
  });
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

  // Sourced from the archive, and nothing on it to ask by or compare.
  it('does not hold the archive certificate, which carries no QR code', () => {
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
