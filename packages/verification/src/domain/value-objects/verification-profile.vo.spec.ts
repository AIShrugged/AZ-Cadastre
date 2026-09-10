import { describe, expect, it } from 'vitest';

import {
  CrossCheckNotInProfileException,
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
     * One ground, and it is the only paper in this profile that grants
     * anything. The plan-scheme depicts, the archival certificate attests, the
     * receipt records a payment and the application asks — offering any of them
     * as a ground would put a choice on the intake screen that means nothing.
     */
    it('registers a right founded on the order that allotted the parcel', () => {
      expect(INTAKE.grounds.map(ground => ground.value)).toEqual([
        'disposal_order',
      ]);
      expect(INTAKE.registers(DocumentType.create('disposal_order'))).toBe(
        true,
      );
    });

    it('registers a right founded on none of its other papers', () => {
      for (const type of CADASTRE_TYPES.filter(
        key => key !== 'disposal_order',
      )) {
        expect(INTAKE.registers(DocumentType.create(type))).toBe(false);
      }
    });

    /*
     * The supporting documents a case needs turn on the year (ADR-0013), but
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
