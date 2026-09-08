import { describe, expect, it } from 'vitest';

import {
  CrossCheckNotInProfileException,
  UnknownProfileException,
} from '../exceptions/index.js';

import { CrossCheckKey } from './cross-check.vo.js';
import { DocumentType } from './document-type.vo.js';
import { FieldKey } from './field.vo.js';
import { VerificationProfile } from './verification-profile.vo.js';

const CADASTRE_TYPES = [
  'land_plot_plan',
  'disposal_order',
  'payment_receipt',
  'sketch_project',
  'archive_certificate',
  'application',
  'identity_card',
];

describe('VerificationProfile', () => {
  it('accepts each profile the system is shipped with', () => {
    expect(VerificationProfile.of('cadastre')).toBe(
      VerificationProfile.CADASTRE,
    );
  });

  it('refuses a padded key, because a profile key is matched and never tidied', () => {
    expect(() => VerificationProfile.of('  cadastre  ')).toThrow(
      UnknownProfileException,
    );
  });

  it('refuses a profile the system does not ship', () => {
    expect(() => VerificationProfile.of('mortgage')).toThrow(
      UnknownProfileException,
    );
  });

  it('refuses the profile the system used to demonstrate itself with', () => {
    expect(() => VerificationProfile.of('demo')).toThrow(
      UnknownProfileException,
    );
  });

  it('refuses an empty profile key', () => {
    expect(() => VerificationProfile.of('')).toThrow(UnknownProfileException);
    expect(() => VerificationProfile.of('   ')).toThrow(
      UnknownProfileException,
    );
  });

  it('says which key it was asked for when it refuses', () => {
    expect(() => VerificationProfile.of('mortgage')).toThrow(/"mortgage"/);
  });

  it('lists every profile it ships, in the order they are offered', () => {
    expect(VerificationProfile.all.map(profile => profile.key)).toEqual([
      'cadastre',
    ]);
  });

  describe('the types a package of its kind is made of', () => {
    it('names them in report order', () => {
      expect(
        VerificationProfile.CADASTRE.documentTypes.map(type => type.value),
      ).toEqual(CADASTRE_TYPES);
    });

    it('never offers the classifier a type it cannot place', () => {
      expect(
        VerificationProfile.CADASTRE.documentTypes.every(type => type.isKnown),
      ).toBe(true);
    });
  });

  describe('what a package must carry', () => {
    it('requires every document of the mandatory set', () => {
      expect(
        VerificationProfile.CADASTRE.requiredTypes.map(type => type.value),
      ).toEqual(CADASTRE_TYPES);
    });

    it('names only types it recognises as required', () => {
      for (const type of VerificationProfile.CADASTRE.requiredTypes) {
        expect(VerificationProfile.CADASTRE.recognises(type)).toBe(true);
      }
    });
  });

  describe('the marks an office leaves on a paper it issues', () => {
    // The judgement of ADR-0012, written out so that changing it is a change to
    // this list and not a side effect of editing a description.
    const EXPECTED: Readonly<
      Record<string, { stamp: boolean; signature: boolean }>
    > = {
      land_plot_plan: { stamp: true, signature: true },
      disposal_order: { stamp: true, signature: true },
      payment_receipt: { stamp: false, signature: false },
      sketch_project: { stamp: true, signature: true },
      archive_certificate: { stamp: true, signature: true },
      application: { stamp: false, signature: true },
      identity_card: { stamp: false, signature: false },
    };

    it('says of every type it declares whether it is sealed and signed', () => {
      for (const spec of VerificationProfile.CADASTRE.specs) {
        const expected = EXPECTED[spec.type.value];

        expect(expected).toBeDefined();
        expect(spec.expectsStamp).toBe(expected!.stamp);
        expect(spec.expectsSignature).toBe(expected!.signature);
      }
    });

    it('asks no seal of a paper nobody seals', () => {
      const receipt = VerificationProfile.CADASTRE.specFor(
        DocumentType.create('payment_receipt'),
      );

      expect(receipt.expectsStamp).toBe(false);
      expect(receipt.expectsSignature).toBe(false);
    });

    it('asks a signature and no seal of the paper an applicant writes', () => {
      const application = VerificationProfile.CADASTRE.specFor(
        DocumentType.create('application'),
      );

      expect(application.expectsStamp).toBe(false);
      expect(application.expectsSignature).toBe(true);
    });

    it('asks nothing of a type it does not recognise', () => {
      const unknown = VerificationProfile.CADASTRE.specFor(
        DocumentType.create('driver_license'),
      );

      expect(unknown.expectsStamp).toBe(false);
      expect(unknown.expectsSignature).toBe(false);
    });
  });

  describe('recognising a type', () => {
    it('recognises a type it declares', () => {
      expect(
        VerificationProfile.CADASTRE.recognises(
          DocumentType.create('archive_certificate'),
        ),
      ).toBe(true);
    });

    it('does not recognise a type it no longer declares', () => {
      expect(
        VerificationProfile.CADASTRE.recognises(
          DocumentType.create('driver_license'),
        ),
      ).toBe(false);
    });

    it('does not recognise a type no profile declares', () => {
      expect(
        VerificationProfile.CADASTRE.recognises(DocumentType.create('invoice')),
      ).toBe(false);
    });

    it('does not recognise the type of a document that could not be placed', () => {
      expect(
        VerificationProfile.CADASTRE.recognises(DocumentType.UNKNOWN),
      ).toBe(false);
    });
  });

  describe('what a classifier is told about a type', () => {
    it('describes each type it declares, so two like ones can be told apart', () => {
      for (const spec of VerificationProfile.CADASTRE.specs) {
        expect(spec.description.length).toBeGreaterThan(0);
        expect(spec.hints.length).toBeGreaterThan(0);
      }
    });

    it('tells the plan of the plot apart from the design of the house', () => {
      const plan = VerificationProfile.CADASTRE.specFor(
        DocumentType.create('land_plot_plan'),
      );
      const project = VerificationProfile.CADASTRE.specFor(
        DocumentType.create('sketch_project'),
      );

      expect(plan.description).toMatch(/not the building/i);
      expect(project.description).toMatch(/not the plot/i);
    });

    it('gives the headings in the languages the papers are written in', () => {
      const identity = VerificationProfile.CADASTRE.specFor(
        DocumentType.create('identity_card'),
      );

      expect(identity.hints).toContain('şəxsiyyət vəsiqəsi');
      expect(identity.hints).toContain('удостоверение личности');
    });

    it('says nothing about a type it does not recognise, and asks nothing of it', () => {
      const stray = VerificationProfile.CADASTRE.specFor(
        DocumentType.create('invoice'),
      );

      expect(stray.hints).toEqual([]);
      expect(stray.schema.isEmpty).toBe(true);
      expect(stray.isRequired).toBe(false);
    });
  });

  describe('the schema of a type', () => {
    it('declares what to pull from an identity card', () => {
      const schema = VerificationProfile.CADASTRE.schemaFor(
        DocumentType.create('identity_card'),
      );

      expect(schema.specs.map(spec => spec.key.value)).toEqual([
        'first_name',
        'last_name',
        'document_no',
        'issue_date',
        'expiry_date',
      ]);
    });

    it('labels each field for the human who reads it', () => {
      const schema = VerificationProfile.CADASTRE.schemaFor(
        DocumentType.create('payment_receipt'),
      );

      expect(schema.specs.map(spec => spec.label)).toEqual([
        'Receipt number',
        'Payer name',
        'Amount paid',
        'Payment date',
        'Payment purpose',
      ]);
    });

    it('declares the keys of that type and no others', () => {
      const schema = VerificationProfile.CADASTRE.schemaFor(
        DocumentType.create('application'),
      );

      expect(schema.declares(FieldKey.create('cadastral_number'))).toBe(true);
      expect(schema.declares(FieldKey.create('receipt_no'))).toBe(false);
    });

    it('declares nothing for a type it does not recognise', () => {
      const schema = VerificationProfile.CADASTRE.schemaFor(
        DocumentType.create('driver_license'),
      );

      expect(schema.isEmpty).toBe(true);
      expect(schema.declares(FieldKey.create('license_no'))).toBe(false);
    });

    it('declares nothing for a document that could not be placed', () => {
      expect(
        VerificationProfile.CADASTRE.schemaFor(DocumentType.UNKNOWN).isEmpty,
      ).toBe(true);
    });

    it('has the papers that name the same property agree on the key that ties them together', () => {
      const plan = VerificationProfile.CADASTRE.schemaFor(
        DocumentType.create('land_plot_plan'),
      );
      const application = VerificationProfile.CADASTRE.schemaFor(
        DocumentType.create('application'),
      );

      expect(plan.declares(FieldKey.create('cadastral_number'))).toBe(true);
      expect(application.declares(FieldKey.create('cadastral_number'))).toBe(
        true,
      );
    });
  });

  describe('what it says has to agree across documents', () => {
    const CADASTRE = VerificationProfile.CADASTRE;

    it('holds the person on the identity document against the applicant', () => {
      const check = CADASTRE.checkFor(
        CrossCheckKey.create('applicant_identity'),
      );

      expect(
        check.references.map(
          reference => `${reference.type.value}.${reference.key.value}`,
        ),
      ).toEqual([
        'identity_card.last_name',
        'identity_card.first_name',
        'application.applicant_name',
      ]);
    });

    it('reaches only for fields the document types it names actually declare', () => {
      for (const check of CADASTRE.crossChecks) {
        for (const reference of check.references) {
          expect(
            CADASTRE.schemaFor(reference.type).declares(reference.key),
          ).toBe(true);
        }
      }
    });

    it('names at least two document types per check, or it compares nothing', () => {
      for (const check of CADASTRE.crossChecks) {
        const types = new Set(
          check.references.map(reference => reference.type.value),
        );

        expect(types.size).toBeGreaterThanOrEqual(2);
      }
    });

    it('says what agreement means for every check, since that is the whole rule', () => {
      for (const check of CADASTRE.crossChecks) {
        expect(check.description.length).toBeGreaterThan(0);
        expect(check.agreesWhen.length).toBeGreaterThan(0);
      }
    });

    it('knows which field of which type a check reaches for', () => {
      const check = CADASTRE.checkFor(CrossCheckKey.create('cadastral_number'));

      expect(
        check.wants(
          DocumentType.create('land_plot_plan'),
          FieldKey.create('cadastral_number'),
        ),
      ).toBe(true);
      expect(
        check.wants(
          DocumentType.create('payment_receipt'),
          FieldKey.create('cadastral_number'),
        ),
      ).toBe(false);
    });

    it('refuses a check it does not declare', () => {
      expect(() =>
        CADASTRE.checkFor(CrossCheckKey.create('shoe_size')),
      ).toThrow(CrossCheckNotInProfileException);
    });

    it('declares only checks with keys of their own', () => {
      const keys = CADASTRE.crossChecks.map(check => check.key.value);

      expect(new Set(keys).size).toBe(keys.length);
    });
  });

  /*
   * The branch that decides which supporting documents a case needs. What is
   * under test is the mechanism, not the numbers: the thresholds it is exercised
   * with come from `supporting-documents.table.ts`, which says of itself that
   * they are provisional and unconfirmed by the customer (ADR-0013).
   */
  describe('the supporting documents it branches into', () => {
    const BRANCH = VerificationProfile.CADASTRE.supportingDocuments[0]!;

    it('declares one branch, decided on the building and not on the papers', () => {
      expect(VerificationProfile.CADASTRE.supportingDocuments).toHaveLength(1);
      expect(BRANCH.key).toBe('building_supporting_documents');
    });

    it('reads the height off the paper that describes the building', () => {
      expect(
        BRANCH.height[0]?.matches(
          DocumentType.create('sketch_project'),
          FieldKey.create('building_height'),
        ),
      ).toBe(true);
    });

    // In the order the papers are believed, like a registry check's subject:
    // the first the package states is the one read.
    it('names more than one place the year may be printed', () => {
      expect(BRANCH.builtIn.length).toBeGreaterThan(1);
      expect(
        BRANCH.builtIn[0]?.matches(
          DocumentType.create('sketch_project'),
          FieldKey.create('approval_date'),
        ),
      ).toBe(true);
    });

    it('declares only bands with keys of their own', () => {
      const keys = BRANCH.bands.map(band => band.key);

      expect(new Set(keys).size).toBe(keys.length);
    });

    it('asks for at least one paper in every band it declares', () => {
      for (const band of BRANCH.bands) {
        expect(band.documents.length).toBeGreaterThan(0);
      }
    });

    it('places a case in the band that covers it', () => {
      expect(BRANCH.bandFor(9.4, 2025)?.key).toBe('low_rise_recent');
      expect(BRANCH.bandFor(9.4, 2005)?.key).toBe('low_rise_legacy');
      expect(BRANCH.bandFor(18, 2025)?.key).toBe('mid_rise');
      expect(BRANCH.bandFor(31, 2025)?.key).toBe('high_rise');
    });

    // Inclusive at the bottom, exclusive at the top, so neighbouring bands can
    // be written the way they are spoken without arguing over the boundary.
    it('gives a figure exactly on a bound to the band that bound opens', () => {
      expect(BRANCH.bandFor(12, 2025)?.key).toBe('mid_rise');
      expect(BRANCH.bandFor(11.99, 2025)?.key).toBe('low_rise_recent');
      expect(BRANCH.bandFor(25, 2025)?.key).toBe('high_rise');
      expect(BRANCH.bandFor(9.4, 2010)?.key).toBe('low_rise_recent');
      expect(BRANCH.bandFor(9.4, 2009)?.key).toBe('low_rise_legacy');
    });

    it('places a case on a rule that does not turn on the year without one', () => {
      expect(BRANCH.bandFor(18, null)?.key).toBe('mid_rise');
    });

    /*
     * The whole reason a measure that could not be read is null rather than a
     * default: a band whose rule turns on that measure must not answer, because
     * answering means guessing which side of a threshold the case falls on.
     */
    it('places no case on a rule that turns on a figure nobody could read', () => {
      expect(BRANCH.bandFor(null, 2025)).toBeNull();
      expect(BRANCH.bandFor(9.4, null)).toBeNull();
      expect(BRANCH.bandFor(null, null)).toBeNull();
    });

    it('says what each band answers for, so the report can quote the rule', () => {
      expect(BRANCH.bandFor(18, 2025)?.bounds).toBe('12 m to below 25 m');
      expect(BRANCH.bandFor(31, 2025)?.bounds).toBe('25 m and above');
      expect(BRANCH.bandFor(9.4, 2025)?.bounds).toBe(
        'below 12 m, built 2010 and above',
      );
      expect(BRANCH.bandFor(9.4, 2005)?.bounds).toBe(
        'below 12 m, built below 2010',
      );
    });
  });

  it('is equal to another handle on the same profile', () => {
    expect(
      VerificationProfile.CADASTRE.equals(VerificationProfile.of('cadastre')),
    ).toBe(true);
  });
});
