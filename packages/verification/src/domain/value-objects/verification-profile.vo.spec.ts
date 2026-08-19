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

  it('is equal to another handle on the same profile', () => {
    expect(
      VerificationProfile.CADASTRE.equals(VerificationProfile.of('cadastre')),
    ).toBe(true);
  });
});
