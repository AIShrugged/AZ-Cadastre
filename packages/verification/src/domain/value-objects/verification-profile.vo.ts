import {
  CrossCheckNotInProfileException,
  RegistryCheckNotInProfileException,
  UnknownProfileException,
} from '../exceptions/index.js';

import { CrossCheckKey } from './cross-check.vo.js';
import { DocumentType } from './document-type.vo.js';
import { FieldSchema, FieldSpec } from './field-schema.vo.js';
import { FieldKey } from './field.vo.js';
import { RegistryCheckKey } from './registry-check.vo.js';

type Declaration = {
  readonly key: string;
  // What the document is, in one line of English. This is what a classifier is
  // told about the type, so it has to distinguish this type from its
  // neighbours — "annex to a licence, not the licence itself" is the whole job.
  readonly description: string;
  // Headings as they actually appear on the paper, in the languages it is
  // written in. Azerbaijani first, then Russian.
  readonly hints: readonly string[];
  readonly required: boolean;
  readonly fields: readonly (readonly [string, string])[];
};

// A rule that spans documents: values printed on different papers of the same
// submission which have to be the same value. Whether they are is a judgement,
// not a string comparison — a surname is printed in capitals on the identity
// card and in an oblique case on the application, and both are the same person
// — so the profile says what is being compared and what counts as agreeing, and
// the stage's reader answers.
type CrossCheckDeclaration = {
  readonly key: string;
  // What the check is about, in one line: the thing the documents must agree
  // on, not the fields it is spelled out in.
  readonly description: string;
  // What agreement means for this particular value, written for whoever judges
  // it. This is the whole rule: everything the reader is allowed to forgive has
  // to be said here, and everything it must not forgive too.
  readonly agreesWhen: string;
  // [document type key, field key], in the order the check reads them. The
  // first is the anchor: the finding is filed against it.
  readonly fields: readonly (readonly [string, string])[];
};

// A rule that leaves the submission: a value printed on one of these papers,
// held against what the archive register holds about the property. The
// difference from a cross-check is what it is compared with — not another sheet
// of the same envelope but the record of what was registered — and that is the
// whole reason it is a declaration of its own (ADR-0009).
type RegistryCheckDeclaration = {
  readonly key: string;
  readonly description: string;
  // The value the register is asked about: [document type key, field key]. The
  // finding is filed against this document, because it is the sheet the
  // inspector opens to see what the package claims.
  readonly subject: readonly [string, string];
  // What else the package says about the property, and the name the register
  // knows each of them by: [register attribute, document type key, field key].
  // A name the register does not know is not an error — it comes back as
  // silence, the same as a column an area's register never carried.
  readonly attributes: readonly (readonly [string, string, string])[];
};

// One value the check reaches for, named by the document type that carries it.
export class FieldRef {
  private constructor(
    public readonly type: DocumentType,
    public readonly key: FieldKey,
  ) {}

  static of(type: DocumentType, key: FieldKey): FieldRef {
    return new FieldRef(type, key);
  }

  matches(type: DocumentType, key: FieldKey): boolean {
    return this.type.equals(type) && this.key.equals(key);
  }
}

export class CrossCheckSpec {
  readonly #references: readonly FieldRef[];

  private constructor(
    public readonly key: CrossCheckKey,
    public readonly description: string,
    public readonly agreesWhen: string,
    references: readonly FieldRef[],
  ) {
    this.#references = [...references];
  }

  static of(declaration: CrossCheckDeclaration): CrossCheckSpec {
    return new CrossCheckSpec(
      CrossCheckKey.create(declaration.key),
      declaration.description,
      declaration.agreesWhen,
      declaration.fields.map(([type, field]) =>
        FieldRef.of(DocumentType.create(type), FieldKey.create(field)),
      ),
    );
  }

  get references(): readonly FieldRef[] {
    return this.#references;
  }

  wants(type: DocumentType, key: FieldKey): boolean {
    return this.#references.some(reference => reference.matches(type, key));
  }
}

export class RegistryCheckSpec {
  readonly #attributes: readonly { name: string; ref: FieldRef }[];

  private constructor(
    public readonly key: RegistryCheckKey,
    public readonly description: string,
    public readonly subject: FieldRef,
    attributes: readonly { name: string; ref: FieldRef }[],
  ) {
    this.#attributes = [...attributes];
  }

  static of(declaration: RegistryCheckDeclaration): RegistryCheckSpec {
    const [subjectType, subjectField] = declaration.subject;

    return new RegistryCheckSpec(
      RegistryCheckKey.create(declaration.key),
      declaration.description,
      FieldRef.of(
        DocumentType.create(subjectType),
        FieldKey.create(subjectField),
      ),
      declaration.attributes.map(([name, type, field]) => ({
        name,
        ref: FieldRef.of(DocumentType.create(type), FieldKey.create(field)),
      })),
    );
  }

  get attributes(): readonly { name: string; ref: FieldRef }[] {
    return this.#attributes;
  }
}

export class DocumentTypeSpec {
  private constructor(
    public readonly type: DocumentType,
    public readonly description: string,
    public readonly hints: readonly string[],
    public readonly schema: FieldSchema,
    public readonly isRequired: boolean,
  ) {}

  static of(declaration: Declaration): DocumentTypeSpec {
    return new DocumentTypeSpec(
      DocumentType.create(declaration.key),
      declaration.description,
      [...declaration.hints],
      FieldSchema.of(
        declaration.fields.map(([key, label]) => FieldSpec.of(key, label)),
      ),
      declaration.required,
    );
  }

  // A type the active profile says nothing about — a document classified under
  // a profile this package was not opened with, or under one this build has
  // since changed. It declares no fields, so nothing is extracted from it and
  // nothing counts it as missing.
  static unrecognised(type: DocumentType): DocumentTypeSpec {
    return new DocumentTypeSpec(type, '', [], FieldSchema.none(), false);
  }
}

export class VerificationProfile {
  // The one case the system handles: first state registration of an individual
  // residential house. The key is what every stored package names its policy
  // by, so it outlives the wording — the profile's name is a UI string in three
  // languages, not this.
  //
  // Every type here is required: the profile is the mandatory set, and the
  // additional documents a submission may carry are out of scope for now.
  static readonly CADASTRE = new VerificationProfile(
    'cadastre',
    [
      {
        key: 'land_plot_plan',
        description:
          'Plan-scheme of the land parcel: the surveyed drawing of the plot ' +
          'with its boundaries, area and cadastral number. It depicts the land ' +
          'itself, not the building proposed on it.',
        hints: [
          'torpaq sahəsinin plan-sxemi',
          'plan-sxem',
          'план-схема земельного участка',
          'план-схема',
        ],
        required: true,
        fields: [
          ['property_address', 'Property address'],
          ['cadastral_number', 'Cadastral number'],
          ['plot_area', 'Plot area'],
          ['owner_name', 'Owner name'],
          ['plan_date', 'Plan date'],
        ],
      },
      {
        key: 'disposal_order',
        description:
          'Order of the executive authority allotting the land parcel, or an ' +
          'extract from that order. It is issued by an authority and carries an ' +
          'order number and date — an extract states the same order in short.',
        hints: [
          'sərəncamdan çıxarış',
          'sərəncam',
          'выписка из распоряжения',
          'распоряжение',
        ],
        required: true,
        fields: [
          ['order_no', 'Order number'],
          ['issuing_authority', 'Issuing authority'],
          ['issue_date', 'Issue date'],
          ['applicant_name', 'Applicant name'],
          ['property_address', 'Property address'],
          ['plot_area', 'Plot area'],
        ],
      },
      {
        key: 'payment_receipt',
        description:
          'Receipt for the state duty paid for the registration. Carries a ' +
          'receipt number, the payer, an amount and the date it was paid.',
        hints: ['ödəniş qəbzi', 'qəbz', 'квитанция об оплате', 'квитанция'],
        required: true,
        fields: [
          ['receipt_no', 'Receipt number'],
          ['payer_name', 'Payer name'],
          ['amount', 'Amount paid'],
          ['payment_date', 'Payment date'],
          ['payment_purpose', 'Payment purpose'],
        ],
      },
      {
        key: 'sketch_project',
        description:
          'Sketch design of the house, produced by a design organisation. ' +
          "Carries drawings, the designer's name and the areas and storeys of " +
          'what is proposed — the building, not the plot it stands on.',
        hints: [
          'eskiz layihəsi',
          'eskiz layihə',
          'эскизный проект',
          'эскизного проекта',
        ],
        required: true,
        fields: [
          ['project_name', 'Project name'],
          ['designer_name', 'Design organisation'],
          ['property_address', 'Property address'],
          ['total_area', 'Total area'],
          ['storeys', 'Storeys'],
          ['approval_date', 'Approval date'],
        ],
      },
      {
        key: 'archive_certificate',
        description:
          'Archival certificate: the statement an archive issues about the ' +
          'history of the plot or the building — what is on record about it, ' +
          'under a certificate number and a date of issue.',
        hints: [
          'arxiv arayışı',
          'arxiv arayış',
          'архивная справка',
          'архивной справки',
        ],
        required: true,
        fields: [
          ['certificate_no', 'Certificate number'],
          ['issuing_authority', 'Issuing authority'],
          ['issue_date', 'Issue date'],
          ['property_address', 'Property address'],
          ['owner_name', 'Owner name'],
        ],
      },
      {
        key: 'application',
        description:
          "The applicant's own application for state registration, addressed " +
          'to the registration authority. Names the applicant, their identity ' +
          'document and the property the registration concerns.',
        hints: [
          'dövlət qeydiyyatı haqqında ərizə',
          'ərizə',
          'заявление о государственной регистрации',
          'заявление',
        ],
        required: true,
        fields: [
          ['applicant_name', 'Applicant name'],
          ['applicant_document_no', 'Applicant identity document number'],
          ['property_address', 'Property address'],
          ['cadastral_number', 'Cadastral number'],
          ['application_date', 'Application date'],
        ],
      },
      {
        key: 'identity_card',
        description:
          'State-issued identity document of a natural person — an identity ' +
          'card or a passport. Carries a photograph, a surname and given name, ' +
          'a document number and validity dates.',
        hints: [
          'şəxsiyyət vəsiqəsi',
          'удостоверение личности',
          'identity card',
          'паспорт',
          'passport',
        ],
        required: true,
        fields: [
          ['first_name', 'First name'],
          ['last_name', 'Last name'],
          ['document_no', 'Document number'],
          ['issue_date', 'Issue date'],
          ['expiry_date', 'Expiration date'],
        ],
      },
    ],
    // What has to be the same across the papers. Each of these is a question an
    // inspector asks by holding two sheets side by side, and the one the operator
    // named first: is the person on the identity document the person the
    // application is for.
    [
      {
        key: 'applicant_identity',
        description:
          'The person the registration is for. The identity document prints a ' +
          'surname and a given name in fields of their own; the application ' +
          'prints one full name, usually surname first and often with a ' +
          'patronymic.',
        agreesWhen:
          'the names denote the same person. Word order, a patronymic present ' +
          'on one document and absent from the other, capitalisation, an ' +
          'Azerbaijani case ending on a form (Əliyeva Rübabə Kavı qızına is the ' +
          'same name as Əliyeva Rübabə Kavı qızı), and transliteration between ' +
          'Latin and Cyrillic script are all the same name. A different surname, ' +
          'or a given name that is a different name rather than a spelling of ' +
          'the same one, is not.',
        fields: [
          ['identity_card', 'last_name'],
          ['identity_card', 'first_name'],
          ['application', 'applicant_name'],
        ],
      },
      {
        key: 'identity_document_no',
        description:
          'The identity document number: the one printed on the card itself, ' +
          'and the one the applicant wrote on the application as theirs.',
        agreesWhen:
          'the two numbers are the same document number. Spacing, hyphens and ' +
          'a series prefix written apart from the digits are formatting; a ' +
          'different digit is a different document.',
        fields: [
          ['identity_card', 'document_no'],
          ['application', 'applicant_document_no'],
        ],
      },
      {
        key: 'property_address',
        description:
          'The address of the property being registered, as each document in ' +
          'the submission states it.',
        agreesWhen:
          'the addresses denote the same place. Abbreviations (küç. / küçəsi, ' +
          'ул. / улица), an administrative level one document spells out and ' +
          'another omits, word order and script are formatting. A different ' +
          'house or plot number, street or settlement is a different address.',
        fields: [
          ['application', 'property_address'],
          ['land_plot_plan', 'property_address'],
          ['disposal_order', 'property_address'],
          ['sketch_project', 'property_address'],
          ['archive_certificate', 'property_address'],
        ],
      },
      {
        key: 'cadastral_number',
        description:
          'The cadastral number of the parcel: the one surveyed on the ' +
          'plan-scheme, and the one the application is made under.',
        agreesWhen:
          'the numbers are the same cadastral number. Separators and spacing ' +
          'are formatting; a different group of digits is a different parcel.',
        fields: [
          ['land_plot_plan', 'cadastral_number'],
          ['application', 'cadastral_number'],
        ],
      },
      {
        key: 'plot_area',
        description:
          'The area of the land parcel: the surveyed figure on the plan-scheme ' +
          'and the figure the order allotted.',
        agreesWhen:
          'the two figures are the same area. Units written differently (m², ' +
          'kv.m, sot, hektar) and decimal comma against decimal point are ' +
          'formatting, and so is a figure given to more places than the other — ' +
          'convert before judging. A genuinely different area is a finding, ' +
          'however small the difference.',
        fields: [
          ['land_plot_plan', 'plot_area'],
          ['disposal_order', 'plot_area'],
        ],
      },
    ],
    // What the papers say about the property, held against what the archive
    // holds about it. The submission agreeing with itself is not evidence that
    // it agrees with the record, which is the whole of what this adds.
    [
      {
        key: 'property_of_record',
        description:
          'The property the registration is for, as the application addresses ' +
          'it, against the archive record of that address.',
        subject: ['application', 'property_address'],
        attributes: [
          // The owner the archive certificate names against the right holder of
          // record — the one attribute the 2008 transfer of cases between the
          // Absheron and Baku offices is known to have changed.
          ['ownerName', 'archive_certificate', 'owner_name'],
          ['cadastralNumber', 'land_plot_plan', 'cadastral_number'],
          ['plotArea', 'land_plot_plan', 'plot_area'],
        ],
      },
    ],
  );

  readonly #specs: readonly DocumentTypeSpec[];
  readonly #crossChecks: readonly CrossCheckSpec[];
  readonly #registryChecks: readonly RegistryCheckSpec[];

  private constructor(
    public readonly key: string,
    declarations: readonly Declaration[],
    crossChecks: readonly CrossCheckDeclaration[],
    registryChecks: readonly RegistryCheckDeclaration[] = [],
  ) {
    this.#specs = declarations.map(declaration =>
      DocumentTypeSpec.of(declaration),
    );
    this.#crossChecks = crossChecks.map(declaration =>
      CrossCheckSpec.of(declaration),
    );
    this.#registryChecks = registryChecks.map(declaration =>
      RegistryCheckSpec.of(declaration),
    );
  }

  // The order a caller is offered them in, and a getter so it cannot be read
  // before the static instances exist.
  static get all(): readonly VerificationProfile[] {
    return [VerificationProfile.CADASTRE];
  }

  static of(rawKey: string): VerificationProfile {
    const found = VerificationProfile.all.find(
      candidate => candidate.key === rawKey,
    );

    if (!found) throw new UnknownProfileException(rawKey);

    return found;
  }

  get specs(): readonly DocumentTypeSpec[] {
    return this.#specs;
  }

  get crossChecks(): readonly CrossCheckSpec[] {
    return this.#crossChecks;
  }

  declaresCheck(key: CrossCheckKey): boolean {
    return this.#crossChecks.some(spec => spec.key.equals(key));
  }

  checkFor(key: CrossCheckKey): CrossCheckSpec {
    const found = this.#crossChecks.find(spec => spec.key.equals(key));

    if (!found) throw new CrossCheckNotInProfileException(key.value, this.key);

    return found;
  }

  get registryChecks(): readonly RegistryCheckSpec[] {
    return this.#registryChecks;
  }

  declaresRegistryCheck(key: RegistryCheckKey): boolean {
    return this.#registryChecks.some(spec => spec.key.equals(key));
  }

  registryCheckFor(key: RegistryCheckKey): RegistryCheckSpec {
    const found = this.#registryChecks.find(spec => spec.key.equals(key));

    if (!found) {
      throw new RegistryCheckNotInProfileException(key.value, this.key);
    }

    return found;
  }

  get documentTypes(): readonly DocumentType[] {
    return this.#specs.map(spec => spec.type);
  }

  get requiredTypes(): readonly DocumentType[] {
    return this.#specs.filter(spec => spec.isRequired).map(spec => spec.type);
  }

  recognises(type: DocumentType): boolean {
    return this.#specs.some(spec => spec.type.equals(type));
  }

  specFor(type: DocumentType): DocumentTypeSpec {
    return (
      this.#specs.find(spec => spec.type.equals(type)) ??
      DocumentTypeSpec.unrecognised(type)
    );
  }

  schemaFor(type: DocumentType): FieldSchema {
    return this.specFor(type).schema;
  }

  equals(other: VerificationProfile): boolean {
    return this.key === other.key;
  }
}
