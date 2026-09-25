import { describe, expect, it } from 'vitest';

import {
  CrossCheckNotInProfileException,
  FieldIsNoFigureException,
  UnknownProfileException,
} from '../exceptions/index.js';

import { CrossCheckKey } from './cross-check.vo.js';
import { DocumentType } from './document-type.vo.js';
import { FieldKey } from './field.vo.js';
import { IntakeSpec, VerificationProfile } from './verification-profile.vo.js';

const CADASTRE_TYPES = [
  'land_plot_plan',
  'disposal_order',
  'payment_receipt',
  'sketch_project',
  'archive_certificate',
  'application',
  'identity_card',
  // What a provision of Article 8 asks for (ADR-0025).
  'approved_design',
  'operation_acceptance_act',
  'construction_permit_decision',
  'construction_permit',
  'architectural_planning_section',
  'operation_permit',
  'construction_completion_notice',
  'designer_licence',
  // The titles to the land (Article 10.2.1).
  'state_register_extract',
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
  'registration_certificate',
  'property_right_certificate',
  'state_property_disposal_act',
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
    /*
     * Two papers whatever the case: the plan of the plot and the sketch design
     * (Articles 10.2.2 and 10.2.3). Everything else a package must carry is
     * decided by the provision of Article 8 its case falls under (ADR-0025).
     */
    it('requires of every package the plan of the plot and the sketch design', () => {
      expect(
        VerificationProfile.CADASTRE.requiredTypes.map(type => type.value),
      ).toEqual(['land_plot_plan', 'sketch_project']);
    });

    it('names only types it recognises as required', () => {
      for (const type of VerificationProfile.CADASTRE.requiredTypes) {
        expect(VerificationProfile.CADASTRE.recognises(type)).toBe(true);
      }
    });
  });

  // What the check of authenticity by QR code is made on, and what it is
  // skipped for want of (ADR-0031).
  describe('the papers that print a QR code', () => {
    const carriers = VerificationProfile.CADASTRE.qrCarriers.map(
      type => type.value,
    );

    it('are every type whose schema declares the code', () => {
      expect(carriers).toContain('land_plot_plan');
      expect(carriers).toContain('state_register_extract');
      expect(carriers).toContain('technical_passport');
      expect(carriers).toContain('land_right_state_act');
      for (const type of VerificationProfile.CADASTRE.documentTypes) {
        expect(carriers.includes(type.value)).toBe(
          VerificationProfile.CADASTRE.schemaFor(type).declares(
            VerificationProfile.QR_CODE,
          ),
        );
      }
    });

    it('leave out a paper that prints none', () => {
      expect(carriers).not.toContain('sketch_project');
      expect(carriers).not.toContain('identity_card');
      expect(carriers).not.toContain('payment_receipt');
    });

    /*
     * Both were read as printing no code until ADR-0034, and the customer's own
     * package disagreed on both: the archive's certificate in it prints a code
     * and so does the order stapled behind it, and they are the two sheets of
     * that package whose codes resolve anywhere at all.
     */
    it('include the two papers the archive certifies copies of', () => {
      expect(carriers).toContain('archive_certificate');
      expect(carriers).toContain('disposal_order');
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
      approved_design: { stamp: true, signature: true },
      operation_acceptance_act: { stamp: true, signature: true },
      construction_permit_decision: { stamp: true, signature: true },
      construction_permit: { stamp: true, signature: true },
      architectural_planning_section: { stamp: true, signature: true },
      operation_permit: { stamp: true, signature: true },
      // Sent by the owner, who signs and has no seal.
      construction_completion_notice: { stamp: false, signature: true },
      designer_licence: { stamp: true, signature: true },
      // Printed off the register with a QR code and not sealed by hand.
      state_register_extract: { stamp: false, signature: false },
      land_right_state_act: { stamp: true, signature: true },
      soviet_land_record: { stamp: true, signature: true },
      land_allocation_decision: { stamp: true, signature: true },
      notarised_land_allocation_contract: { stamp: true, signature: true },
      household_book_extract: { stamp: true, signature: true },
      technical_passport: { stamp: true, signature: true },
      kolkhoz_allocation_decision: { stamp: true, signature: true },
      bound_land_book_extract: { stamp: true, signature: true },
      sovkhoz_allocation_order: { stamp: true, signature: true },
      homestead_land_allocation_decision: { stamp: true, signature: true },
      apartment_demolition_decision: { stamp: true, signature: true },
      registration_certificate: { stamp: true, signature: true },
      property_right_certificate: { stamp: true, signature: true },
      state_property_disposal_act: { stamp: true, signature: true },
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

    /*
     * The acceptance contract the customer attached to COMM-67 numbers what a
     * plan-scheme and a sketch design must yield. These two lists are that
     * contract, key by key: a key that leaves the schema leaves the contract
     * unanswered, and the test says which one rather than a count.
     */
    describe('against the acceptance contract', () => {
      const PLAN_SCHEME = [
        'property_address',
        'cadastral_number',
        'owner_name',
        'land_category',
        'ownership_type',
        'right_type',
        'registry_no',
        'plot_area',
        'actual_area',
        'easements',
        'turning_points',
        'plan_basis',
        'plan_date',
        'plan_scale',
        'issuing_authority',
        'qr_code',
      ];

      const SKETCH_DESIGN = [
        'designer_name',
        'designer_tax_id',
        'designer_director',
        'chief_architect',
        'client_name',
        'property_address',
        'project_name',
        'drawing_schedule',
        'sheet_count',
        'project_composition',
        'built_up_area',
        'total_area',
        'building_volume',
        'storeys',
        'datum_level',
        'building_height',
        'span_dimensions',
        // Not an item of the contract's own list: the overall dimension of
        // each chain, asked for so that the spacings can be added up against
        // it before a span is believed (COMM-160).
        'span_overall_dimensions',
        'project_scale',
        'approval_date',
      ];

      const keysOf = (type: string) =>
        VerificationProfile.CADASTRE.schemaFor(
          DocumentType.create(type),
        ).specs.map(spec => spec.key.value);

      it('asks the plan-scheme for every value the contract names', () => {
        expect(keysOf('land_plot_plan')).toEqual(PLAN_SCHEME);
      });

      it('asks the sketch design for every value the contract names', () => {
        expect(keysOf('sketch_project')).toEqual(SKETCH_DESIGN);
      });

      /*
       * The contract's thirteenth item of a sketch design — the architect's and
       * the director's signature and the seal on every page — is not a value
       * read off the paper but the attestation of it, and the profile already
       * asks for it as `expectsStamp` / `expectsSignature` (ADR-0012). A text
       * field saying "signed" would be the engine reporting a check as a
       * reading.
       */
      it('does not read the attestation of the sketch design as a field of it', () => {
        const sketch = VerificationProfile.CADASTRE.specFor(
          DocumentType.create('sketch_project'),
        );

        for (const key of ['signature', 'seal', 'stamp', 'attestation']) {
          expect(sketch.schema.declares(FieldKey.create(key))).toBe(false);
        }
        expect(sketch.expectsStamp).toBe(true);
        expect(sketch.expectsSignature).toBe(true);
      });

      /*
       * The contract asks a plan-scheme for the area the document states and
       * the area the ground actually measures. `plot_area` is the documentary
       * one and stays it: it is what `plot_area` cross-check holds against the
       * order that allotted the parcel, and moving the surveyed figure into
       * that key would set the check to compare the plan with itself.
       */
      it('keeps the documentary area the one the order is held against', () => {
        const check = VerificationProfile.CADASTRE.checkFor(
          CrossCheckKey.create('plot_area'),
        );

        expect(
          check.references.map(
            reference => `${reference.type.value}.${reference.key.value}`,
          ),
        ).toEqual(['land_plot_plan.plot_area', 'disposal_order.plot_area']);
        expect(
          check.wants(
            DocumentType.create('land_plot_plan'),
            FieldKey.create('actual_area'),
          ),
        ).toBe(false);
      });

      /*
       * The registry number of the entry the plan was drawn from is a second
       * number and not a second name for the first: the cadastral number is the
       * parcel's and is what the registry check and the case's particulars are
       * asked under.
       */
      it('asks for the registry entry apart from the parcel it describes', () => {
        const schema = VerificationProfile.CADASTRE.schemaFor(
          DocumentType.create('land_plot_plan'),
        );

        expect(schema.declares(FieldKey.create('registry_no'))).toBe(true);
        expect(schema.declares(FieldKey.create('cadastral_number'))).toBe(true);
      });

      it('labels every field of both types in English, for the reader of the value', () => {
        for (const type of ['land_plot_plan', 'sketch_project']) {
          for (const spec of VerificationProfile.CADASTRE.schemaFor(
            DocumentType.create(type),
          ).specs) {
            expect(spec.label.length).toBeGreaterThan(0);
          }
        }
      });

      it('declares each key of a type once, so nothing is asked for twice', () => {
        for (const spec of VerificationProfile.CADASTRE.specs) {
          const keys = spec.schema.specs.map(field => field.key.value);

          expect(new Set(keys).size).toBe(keys.length);
        }
      });

      /*
       * Extending the schemas is adding keys and never renaming them: every one
       * of these is stored against documents already verified, and is named by
       * a cross-check, a registry check or the row that says what the case is.
       */
      it('keeps every key the stored packages and the checks were written on', () => {
        expect(keysOf('land_plot_plan')).toEqual(
          expect.arrayContaining([
            'property_address',
            'cadastral_number',
            'plot_area',
            'owner_name',
            'plan_date',
          ]),
        );
        expect(keysOf('sketch_project')).toEqual(
          expect.arrayContaining([
            'project_name',
            'designer_name',
            'property_address',
            'total_area',
            'storeys',
            'building_height',
            'approval_date',
          ]),
        );
      });

      /*
       * A note is what the label has no room for — which of two figures printed
       * together is meant. Only the extraction stage is shown them, so an empty
       * one is a note that says nothing to the only reader it has.
       */
      it('says something in every note it declares', () => {
        for (const spec of VerificationProfile.CADASTRE.specs) {
          for (const field of spec.schema.specs) {
            if (field.note === null) continue;

            expect(field.note.trim().length).toBeGreaterThan(0);
          }
        }
      });

      it('says which of the two areas of a plan-scheme each key means', () => {
        const schema = VerificationProfile.CADASTRE.schemaFor(
          DocumentType.create('land_plot_plan'),
        );
        const noteOn = (key: string) =>
          schema.specs.find(spec => spec.key.value === key)?.note;

        expect(noteOn('plot_area')).toMatch(/documentary/i);
        expect(noteOn('actual_area')).toMatch(/surveyed/i);
      });

      /*
       * The contract does not add a key for either of these; it says what to
       * measure. The height decides which supporting documents the case needs
       * (ADR-0013), so a reader measuring to the ridge instead of the underside
       * of the top covering would branch the case wrongly and silently.
       */
      it('says what the sketch design branches on and where it is counted from', () => {
        const schema = VerificationProfile.CADASTRE.schemaFor(
          DocumentType.create('sketch_project'),
        );
        const noteOn = (key: string) =>
          schema.specs.find(spec => spec.key.value === key)?.note;

        expect(noteOn('building_height')).toMatch(/±0\.000/);
        expect(noteOn('building_height')).toMatch(/UPCC 80\.1/);
        expect(noteOn('storeys')).toMatch(/floor plans/i);
      });
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

    /*
     * Which checks are a map of one value onto several papers, and which
     * compose several fields of one paper into one judgement. Only the first
     * kind can carry a value from one of its papers to another (ADR-0023).
     */
    describe('as a map of where the same value is printed', () => {
      it('says the address is one value on five papers', () => {
        expect(
          CADASTRE.checkFor(CrossCheckKey.create('property_address'))
            .isOneValueAcrossPapers,
        ).toBe(true);
      });

      /*
       * The identity card prints a surname and a given name in two fields and
       * the application prints one full name: nothing there is the same value
       * as anything else, so nothing may be carried between them.
       */
      it('says the applicant check is not, because one paper names two fields', () => {
        expect(
          CADASTRE.checkFor(CrossCheckKey.create('applicant_identity'))
            .isOneValueAcrossPapers,
        ).toBe(false);
      });
    });
  });

  /*
   * Where the policy expects each paper to come from (ADR-0025): the envelope,
   * or a state system that confirms it. Written out so that changing a source
   * is a change to this list and not a side effect of moving a declaration.
   */
  describe('where it expects each paper to come from', () => {
    const EXPECTED: Readonly<Record<string, string>> = {
      land_plot_plan: 'Mqs',
      disposal_order: 'Package',
      payment_receipt: 'Package',
      sketch_project: 'Package',
      archive_certificate: 'NationalArchive',
      application: 'Package',
      identity_card: 'Mqs',
      approved_design: 'Package',
      operation_acceptance_act: 'Package',
      construction_permit_decision: 'Package',
      construction_permit: 'UrbanPlanningCommittee',
      architectural_planning_section: 'Package',
      operation_permit: 'UrbanPlanningCommittee',
      construction_completion_notice: 'UrbanPlanningCommittee',
      designer_licence: 'LicencesPortal',
      state_register_extract: 'Mqs',
      land_right_state_act: 'NationalArchive',
      soviet_land_record: 'NationalArchive',
      land_allocation_decision: 'NationalArchive',
      notarised_land_allocation_contract: 'NationalArchive',
      household_book_extract: 'NationalArchive',
      technical_passport: 'NationalArchive',
      kolkhoz_allocation_decision: 'NationalArchive',
      bound_land_book_extract: 'NationalArchive',
      sovkhoz_allocation_order: 'NationalArchive',
      homestead_land_allocation_decision: 'NationalArchive',
      apartment_demolition_decision: 'NationalArchive',
      registration_certificate: 'Package',
      property_right_certificate: 'Package',
      state_property_disposal_act: 'Package',
    };

    it('says of every type it declares where it comes from', () => {
      for (const spec of VerificationProfile.CADASTRE.specs) {
        expect(spec.source).toBe(EXPECTED[spec.type.value]);
      }
    });

    it('expects nothing from outside of a type it does not recognise', () => {
      expect(
        VerificationProfile.CADASTRE.specFor(DocumentType.create('invoice'))
          .source,
      ).toBe('Package');
    });
  });

  /*
   * The table of provisions the profile holds a case to. The rows themselves are
   * held to the acceptance contract in `provision.vo.spec.ts`; what is under test
   * here is that the profile carries the table and that every paper and every
   * line the table names is one the profile reads.
   */
  describe('the provisions of Article 8 it holds a case to', () => {
    const PROVISIONS = VerificationProfile.CADASTRE.provisions!;

    it('holds the table of provisions of Article 8', () => {
      expect(PROVISIONS.key).toBe('article_8_provisions');
      expect(PROVISIONS.rules.map(rule => rule.provision)).toEqual([
        '8.0.9.1.1',
        '8.0.9.1.2',
        '8.0.9.2',
        '8.0.10.2',
        '8.0.10.1',
      ]);
    });

    it('reads every title document as a type of its own', () => {
      for (const type of PROVISIONS.titleTypes) {
        expect(VerificationProfile.CADASTRE.recognises(type)).toBe(true);
      }
    });

    it('reads a title’s date off a line the title declares', () => {
      for (const entry of PROVISIONS.titleDocuments) {
        expect(
          VerificationProfile.CADASTRE.schemaFor(entry.type).declares(
            entry.dateField,
          ),
        ).toBe(true);
      }
    });

    it('asks for no paper it does not read', () => {
      for (const rule of PROVISIONS.rules) {
        for (const requirement of rule.requirements) {
          for (const type of requirement.anyOf) {
            expect(VerificationProfile.CADASTRE.recognises(type)).toBe(true);
          }
        }
      }
    });

    it('reads every figure off a line the paper declares', () => {
      const figures = [
        ...PROVISIONS.builtIn,
        ...PROVISIONS.storeys,
        ...PROVISIONS.height,
        ...PROVISIONS.span,
        ...PROVISIONS.purpose,
        ...PROVISIONS.landRight,
      ];

      for (const at of figures) {
        expect(
          VerificationProfile.CADASTRE.schemaFor(at.type).declares(at.key),
        ).toBe(true);
      }
    });

    it('reads the height off the design, the paper that describes the building', () => {
      expect(PROVISIONS.height[0]?.type.value).toBe('sketch_project');
      expect(PROVISIONS.height[0]?.key.value).toBe('building_height');
    });

    /*
     * COMM-158. The architectural and planning section is the paper 8.0.10.1
     * and 8.0.10.2 ask for, and 8.0.10.2 is decided on storeys, height and
     * span: it is a place all three are printed, after the two designs
     * (ADR-0045).
     */
    it('reads the three figures of the building off the planning section too', () => {
      for (const places of [
        PROVISIONS.storeys,
        PROVISIONS.height,
        PROVISIONS.span,
      ]) {
        expect(places.map(at => at.type.value)).toEqual([
          'sketch_project',
          'approved_design',
          'architectural_planning_section',
        ]);
      }
    });

    // The span is calculated off the chains of one paper and held against the
    // built-up area of that same paper (ADR-0043), so a paper the span may be
    // read off has to be asked for its own area.
    it('asks every paper a span may be read off for its own built-up area', () => {
      for (const at of PROVISIONS.span) {
        expect(
          VerificationProfile.CADASTRE.schemaFor(at.type).declares(
            FieldKey.create('built_up_area'),
          ),
        ).toBe(true);
      }
    });

    /*
     * The other side of `guardProvisionsAreDeclared` (COMM-158): a field
     * declared under a figure's key on a paper no row names is a value the
     * model is asked for, the page gives and nothing reads — which is exactly
     * how the planning section's storeys were lost. The profile's constructor
     * is private by design; the guard runs in it, so the spec reaches it the
     * one way a spec can.
     */
    describe('a field declared under a figure’s key', () => {
      const build = (declarations: unknown[], provisions: unknown): void => {
        Reflect.construct(VerificationProfile as unknown as Function, [
          'test_profile',
          declarations,
          [],
          [],
          null,
          null,
          provisions,
        ]);
      };

      const aPaper = (key: string, fields: readonly string[]) => ({
        key,
        description: 'A paper.',
        hints: ['paper'],
        required: false,
        alwaysAccepted: false,
        expectsStamp: false,
        expectsSignature: false,
        source: 'Package',
        fields: fields.map(field => [field, field]),
      });

      const provisionsWith = (
        storeys: readonly (readonly [string, string])[],
        notFigures: readonly { type: string; key: string; because: string }[],
      ) => ({
        key: 'test_provisions',
        description: 'A table.',
        builtIn: [],
        storeys,
        height: [],
        span: [],
        purpose: [],
        landRight: [],
        titleDocuments: [],
        notFigures,
        rules: [],
      });

      it('is refused when no row of the table reads it', () => {
        expect(() =>
          build(
            [
              aPaper('sketch_project', ['storeys']),
              aPaper('technical_passport', ['storeys']),
            ],
            provisionsWith([['sketch_project', 'storeys']], []),
          ),
        ).toThrow(FieldIsNoFigureException);
      });

      it('names the paper and the field it refused', () => {
        expect(() =>
          build(
            [
              aPaper('sketch_project', ['storeys']),
              aPaper('technical_passport', ['storeys']),
            ],
            provisionsWith([['sketch_project', 'storeys']], []),
          ),
        ).toThrow(/technical_passport.*storeys/u);
      });

      it('is admitted where the table says in so many words that it is not the figure', () => {
        expect(() =>
          build(
            [
              aPaper('sketch_project', ['storeys']),
              aPaper('technical_passport', ['storeys']),
            ],
            provisionsWith(
              [['sketch_project', 'storeys']],
              [
                {
                  type: 'technical_passport',
                  key: 'storeys',
                  because: 'it counts the storeys as built, not as designed.',
                },
              ],
            ),
          ),
        ).not.toThrow();
      });

      it('asks nothing of a field no figure is read under', () => {
        expect(() =>
          build(
            [
              aPaper('sketch_project', ['storeys']),
              aPaper('payment_receipt', ['amount']),
            ],
            provisionsWith([['sketch_project', 'storeys']], []),
          ),
        ).not.toThrow();
      });
    });

    // A design approved in 2012 is a house built in 2014 as often as not.
    it('does not date a case by when its design was approved', () => {
      expect(
        PROVISIONS.builtIn.some(at => at.key.value === 'approval_date'),
      ).toBe(false);
    });

    it('asks the archive about the originals of the titles its registers keep', () => {
      const [check] = VerificationProfile.CADASTRE.registryChecks;

      expect(check?.documents.map(paper => paper.type.value)).toEqual(
        expect.arrayContaining([
          'land_right_state_act',
          'technical_passport',
          'property_right_certificate',
          'state_property_disposal_act',
        ]),
      );
    });
  });

  /*
   * What a case of this kind is called, and off which paper each of the three
   * values is believed. The profile is the only place that decides it — a list
   * screen choosing for itself would be a second answer to what a submission is
   * — so what is under test here is that the ordering says what it means to say
   * and reaches nothing the profile does not carry.
   */
  describe('what a case of its kind is called', () => {
    const PARTICULARS = VerificationProfile.CADASTRE.particulars;

    const named = (
      references: readonly { type: DocumentType; key: FieldKey }[],
    ) =>
      references.map(
        reference => `${reference.type.value}.${reference.key.value}`,
      );

    it('names the applicant off the papers that state one whole name', () => {
      expect(named(PARTICULARS.applicantName)).toEqual([
        'application.applicant_name',
        'disposal_order.applicant_name',
        'archive_certificate.owner_name',
        'land_plot_plan.owner_name',
      ]);
    });

    /*
     * The plan-scheme first and the application last, which is the order
     * `property_of_record` asks the register in: the address on the plan was
     * written by the office that surveyed the parcel, and the one on the
     * application is where the reading went wrong in both real submissions
     * (ADR-0010). Held here so the row and the archive answer cannot drift into
     * naming two different addresses.
     */
    it('believes the address the same way the register is asked it', () => {
      const asked = named(
        VerificationProfile.CADASTRE.registryChecks[0]!.subjects,
      );
      const believed = named(PARTICULARS.propertyAddress);

      // Every paper the register is asked about is one the row may name the
      // case by, and in the same relative order. The row names two more besides
      // — a case with neither a plan nor a sketch is still a case somebody has
      // to find — but it never prefers a paper the register trusts less.
      expect(believed.filter(paper => asked.includes(paper))).toEqual(asked);
      expect(believed.at(-1)).toBe('application.property_address');
    });

    it('believes the surveyed parcel over the one the applicant wrote down', () => {
      expect(named(PARTICULARS.cadastralNumber)).toEqual([
        'land_plot_plan.cadastral_number',
        'application.cadastral_number',
      ]);
    });

    // The same rule a cross-check is held to: a reference to a field no
    // document type of this profile declares can never be read off anything,
    // so it would leave every row unnamed and say nothing about why.
    it('reaches only for fields the document types it names actually declare', () => {
      for (const reference of PARTICULARS.references) {
        expect(
          VerificationProfile.CADASTRE.schemaFor(reference.type).declares(
            reference.key,
          ),
        ).toBe(true);
      }
    });

    // The identity card prints a surname and a given name in fields of their
    // own. A name assembled out of two readings is a value no document states,
    // and the row would be quoting a paper that does not say it.
    it('never names the applicant off a paper that prints the name in pieces', () => {
      expect(named(PARTICULARS.applicantName)).not.toContain(
        'identity_card.last_name',
      );
      expect(named(PARTICULARS.applicantName)).not.toContain(
        'identity_card.first_name',
      );
    });

    it('holds every reference of the three lists, so a reader can narrow what it loads', () => {
      expect(PARTICULARS.references).toHaveLength(
        PARTICULARS.applicantName.length +
          PARTICULARS.propertyAddress.length +
          PARTICULARS.cadastralNumber.length,
      );
    });
  });

  /*
   * What the profile answers for at the counter, before a sheet has been read.
   * The other end of the same case: everything else this profile says is about
   * documents it will be given, and this is what an operator can say about a
   * case they have not handed over yet.
   */
  describe('what it takes in at the counter', () => {
    const INTAKE = VerificationProfile.CADASTRE.intake;

    /*
     * Any title to the land the table of provisions lists, and nothing else.
     * The plan-scheme depicts, the design draws, the receipt records a payment
     * and the application asks — offering any of them as a ground would put a
     * choice on the intake screen that means nothing (ADR-0025).
     */
    it('registers a right founded on any title to the land', () => {
      const titles = VerificationProfile.CADASTRE.provisions!.titleTypes.map(
        type => type.value,
      );

      expect(INTAKE.grounds.map(ground => ground.value)).toEqual(titles);
      expect(INTAKE.registers(DocumentType.create('disposal_order'))).toBe(
        true,
      );
      expect(
        INTAKE.registers(DocumentType.create('household_book_extract')),
      ).toBe(true);
    });

    it('registers a right founded on none of its papers that grant nothing', () => {
      for (const type of [
        'land_plot_plan',
        'payment_receipt',
        'sketch_project',
        'archive_certificate',
        'application',
        'identity_card',
        'architectural_planning_section',
      ]) {
        expect(INTAKE.registers(DocumentType.create(type))).toBe(false);
      }
    });

    /*
     * Which provision a case falls under turns on the year (ADR-0025), but
     * which profile governs it does not: no norm has been given that says
     * otherwise, and a threshold invented here would silently send submissions
     * to the wrong policy.
     */
    it('answers for a case of any year', () => {
      expect(INTAKE.isBoundedByYear).toBe(false);
      expect(INTAKE.takesCaseFrom(1899)).toBe(true);
      expect(INTAKE.takesCaseFrom(2026)).toBe(true);
      expect(INTAKE.takesCaseFrom(null)).toBe(true);
    });

    // A ground is offered to an operator as one of the profile's own papers, so
    // it has to be one: a key nothing downstream reads would put a choice on
    // the screen that no run could act on.
    it('names only papers it declares as document types', () => {
      for (const ground of INTAKE.grounds) {
        expect(VerificationProfile.CADASTRE.recognises(ground)).toBe(true);
      }
    });

    describe('as a mechanism, apart from what this profile happens to declare', () => {
      // Inclusive at the bottom and exclusive at the top, so two neighbouring
      // profiles do not argue over the year between them — the same convention
      // a requirement band is written in.
      it('reads its year bounds bottom-inclusive and top-exclusive', () => {
        const bounded = IntakeSpec.of({
          grounds: [],
          builtFrom: 2010,
          builtBefore: 2020,
        });

        expect(bounded.takesCaseFrom(2010)).toBe(true);
        expect(bounded.takesCaseFrom(2019)).toBe(true);
        expect(bounded.takesCaseFrom(2020)).toBe(false);
        expect(bounded.takesCaseFrom(2009)).toBe(false);
      });

      // Guessing which side of a threshold an undeclared year falls on is the
      // one thing this must never do.
      it('answers for no undeclared year once it is bounded by one', () => {
        expect(
          IntakeSpec.of({
            grounds: [],
            builtFrom: 2010,
            builtBefore: null,
          }).takesCaseFrom(null),
        ).toBe(false);
      });

      // Not a profile that takes everything: it is one whose author has not
      // said what it is for, so no declaration ever points at it.
      it('registers nothing where a profile declares no intake at all', () => {
        expect(
          IntakeSpec.none().registers(DocumentType.create('disposal_order')),
        ).toBe(false);
        expect(IntakeSpec.none().grounds).toEqual([]);
      });

      it('writes its bounds as a reader would say them', () => {
        expect(
          IntakeSpec.of({ grounds: [], builtFrom: 2010, builtBefore: 2020 })
            .years,
        ).toBe('2010 to below 2020');
        expect(
          IntakeSpec.of({ grounds: [], builtFrom: null, builtBefore: 2010 })
            .years,
        ).toBe('below 2010');
        expect(IntakeSpec.none().years).toBe('');
      });
    });
  });

  it('is equal to another handle on the same profile', () => {
    expect(
      VerificationProfile.CADASTRE.equals(VerificationProfile.of('cadastre')),
    ).toBe(true);
  });
});
