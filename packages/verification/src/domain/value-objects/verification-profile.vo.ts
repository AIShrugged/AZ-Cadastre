import {
  CrossCheckNotInProfileException,
  DocumentTypeNotInProfileException,
  FieldNotInSchemaException,
  RegistryCheckNotInProfileException,
  UnknownProfileException,
} from '../exceptions/index.js';

import { ARTICLE_8_PROVISIONS } from './article-8-provisions.table.js';
import { CrossCheckKey } from './cross-check.vo.js';
import type { DocumentSource } from './document-source.vo.js';
import { DocumentType } from './document-type.vo.js';
import { FieldSchema, FieldSpec } from './field-schema.vo.js';
import { FieldKey } from './field.vo.js';
import { ProvisionsSpec, type ProvisionsDeclaration } from './provision.vo.js';
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
  /*
   * Whether this policy takes a paper of this kind at any time, whether or not
   * the package is short of one.
   *
   * Declared here rather than decided by the engine, because it is a statement
   * about the paper and not about how well anything was read: the receipt for
   * the state duty may be paid and sent in after the submission, or paid twice,
   * or sent in again against a corrected amount, and none of those is a
   * shortfall the report should be carrying. Every other type is offered only
   * when the package is actually short of it (COMM-80).
   *
   * Declared on every type, like the two marks below, so that adding one is
   * answering the question rather than forgetting it.
   */
  readonly alwaysAccepted: boolean;
  // Whether a paper of this kind is only itself once an office has sealed it,
  // and whether a hand has to have signed it. Stated per type and not once for
  // the profile: an applicant has no seal, and a bank terminal prints a receipt
  // that carries neither mark (ADR-0012). Both are declared on every type, so
  // that adding one is answering the question rather than forgetting it.
  readonly expectsStamp: boolean;
  readonly expectsSignature: boolean;
  // Where the policy expects a paper of this kind to come from — the envelope,
  // or a state system that confirms it (ADR-0025). Declared on every type, for
  // the reason the marks are.
  readonly source: DocumentSource;
  // [field key, English label, and an optional note for whoever reads the
  // value off the paper]. The note is the sentence the label has no room for —
  // which of two figures printed together is meant, or where on the sheet the
  // value is written — and it reaches the extraction stage and nothing else.
  readonly fields: readonly (readonly [string, string, string?])[];
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
  // The value the register is asked about, as [document type key, field key],
  // in the order the papers are believed: the first of these the package
  // actually states is the one asked, and the finding is filed against that
  // document, because it is the sheet the inspector opens to see what the
  // package claims.
  //
  // A list and not one pair because an address is printed on several of the
  // papers and they are not equally trustworthy. Both real submissions read so
  // far carry two sheets classified as applications — the form itself, whose
  // address line went unread, and a second sheet whose address came back as
  // "Xetan uue, Burome 98. 5-862 saha". Asking the register about that is
  // asking it about nothing (ADR-0010).
  readonly subject: readonly (readonly [string, string])[];
  // What else the package says about the property, and the name the register
  // knows each of them by: [register attribute, document type key, field key].
  // A name the register does not know is not an error — it comes back as
  // silence, the same as a column an area's register never carried.
  readonly attributes: readonly (readonly [string, string, string])[];
  // Which of the package's papers to ask the archive whether it holds the
  // original of: [the register's word for the kind of paper, document type
  // key]. Two words and not one because there are two vocabularies — the
  // archive's presence registers were written by a different office in a
  // different decade, and neither side may borrow the other's name (ADR-0010).
  //
  // A kind the area's register never had a column for comes back as silence,
  // not as a paper that is missing; only a register that recorded its absence
  // is a finding.
  readonly documents?: readonly (readonly [string, string])[];
};

/*
 * What the case is called outside this system: the person it is for, where the
 * property is, and the parcel that property sits on.
 *
 * Not a fourth kind of check — nothing here is verified, compared or held
 * against anything. It is the profile answering one question the register asks
 * of every submission: of all the values the pipeline read, which three name
 * this case to a person, and off which paper is each of them believed. A list
 * screen that decided that for itself would be a second source of truth for
 * what a submission is, and the first row it disagreed with the package on
 * would be a row nobody could explain.
 *
 * Each is [document type key, field key] in the order the papers are believed,
 * read the same way a registry check's subject is: the first of them this
 * package actually states is the one the row carries. Nothing is composed and
 * nothing is joined — the value is one field as the pipeline read it, or there
 * is none.
 */
export type ParticularsDeclaration = {
  readonly applicantName: readonly (readonly [string, string])[];
  readonly propertyAddress: readonly (readonly [string, string])[];
  readonly cadastralNumber: readonly (readonly [string, string])[];
};

/*
 * What a profile answers for, in the language the office speaks at the counter
 * — before a single sheet has been read.
 *
 * The engine's own view of a submission is built out of what it read; this is
 * the other end of the same case, and it is the only thing a profile can be
 * suggested on. An intake screen has two figures and no documents: which ground
 * the claimed right rests on, and what year the building is said to date from.
 *
 * Naming the grounds is also what lets a screen offer them: the operator picks
 * a ground out of the profile's own list rather than typing one.
 */
export type IntakeDeclaration = {
  // Document type keys of this profile that can be the ground a right is
  // claimed on — the paper that grants something, not the papers that evidence
  // or accompany it. Every one of them must be a type this profile declares:
  // an intake screen offers them as documents, and a ground naming a paper the
  // profile never reads would be a choice nothing downstream could act on.
  readonly grounds: readonly string[];
  // The years this profile answers for — inclusive at the bottom, exclusive at the top, null for an open end.
  // Both null is a profile that takes a case of any year, which is what every
  // profile shipped today is: no norm has been given that turns on the date,
  // and inventing one to make the year look decisive would be inventing policy.
  readonly builtFrom: number | null;
  readonly builtBefore: number | null;
};

// A document type that no profile asks for, declared so it can be named rather
// than bucketed. It answers no requirement and carries no fields, so it says
// only what the thing is and what it is headed (ADR-0012).
export type CatalogueDeclaration = Pick<
  Declaration,
  'key' | 'description' | 'hints'
>;

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

  /*
   * Whether this check is one value printed on several papers, rather than
   * several fields of one paper judged together.
   *
   * The difference decides whether a value may be carried from one of these
   * papers to another. `property_address` names one address on five documents,
   * so a document that did not yield it can be closed with what the others
   * print. `applicant_identity` names the surname *and* the given name on the
   * identity card against the one full name on the application: nothing there
   * is the same value as anything else, and carrying the application's full
   * name into the card's surname field would invent a reading off a rule that
   * never said the two were equal.
   *
   * A document type naming more than one field is what tells them apart, and it
   * is read off the declaration rather than listed anywhere: a profile that adds
   * a composite check gets the right answer without anybody remembering to add
   * it to a second list.
   */
  get isOneValueAcrossPapers(): boolean {
    const types = this.#references.map(reference => reference.type.value);

    return new Set(types).size === types.length;
  }

  wants(type: DocumentType, key: FieldKey): boolean {
    return this.#references.some(reference => reference.matches(type, key));
  }
}

export class RegistryCheckSpec {
  readonly #subjects: readonly FieldRef[];
  readonly #attributes: readonly { name: string; ref: FieldRef }[];
  readonly #documents: readonly { name: string; type: DocumentType }[];

  private constructor(
    public readonly key: RegistryCheckKey,
    public readonly description: string,
    subjects: readonly FieldRef[],
    attributes: readonly { name: string; ref: FieldRef }[],
    documents: readonly { name: string; type: DocumentType }[],
  ) {
    this.#subjects = [...subjects];
    this.#attributes = [...attributes];
    this.#documents = [...documents];
  }

  static of(declaration: RegistryCheckDeclaration): RegistryCheckSpec {
    return new RegistryCheckSpec(
      RegistryCheckKey.create(declaration.key),
      declaration.description,
      declaration.subject.map(([type, field]) =>
        FieldRef.of(DocumentType.create(type), FieldKey.create(field)),
      ),
      declaration.attributes.map(([name, type, field]) => ({
        name,
        ref: FieldRef.of(DocumentType.create(type), FieldKey.create(field)),
      })),
      (declaration.documents ?? []).map(([name, type]) => ({
        name,
        type: DocumentType.create(type),
      })),
    );
  }

  // In the order they are believed. The first the package states is the one
  // asked about.
  get subjects(): readonly FieldRef[] {
    return this.#subjects;
  }

  get attributes(): readonly { name: string; ref: FieldRef }[] {
    return this.#attributes;
  }

  get documents(): readonly { name: string; type: DocumentType }[] {
    return this.#documents;
  }
}

/**
 * The three values a submission is named by, as the engine reads them.
 *
 * Ordered lists and not single references, for the reason a registry check's
 * subject is one: an address is printed on several of the papers and they are
 * not equally trustworthy, and a case whose plan-scheme has not been read yet
 * is still a case somebody has to find in a list.
 */
export class ParticularsSpec {
  readonly #applicantName: readonly FieldRef[];
  readonly #propertyAddress: readonly FieldRef[];
  readonly #cadastralNumber: readonly FieldRef[];

  private constructor(
    applicantName: readonly FieldRef[],
    propertyAddress: readonly FieldRef[],
    cadastralNumber: readonly FieldRef[],
  ) {
    this.#applicantName = [...applicantName];
    this.#propertyAddress = [...propertyAddress];
    this.#cadastralNumber = [...cadastralNumber];
  }

  static of(declaration: ParticularsDeclaration): ParticularsSpec {
    const refs = (
      pairs: readonly (readonly [string, string])[],
    ): readonly FieldRef[] =>
      pairs.map(([type, field]) =>
        FieldRef.of(DocumentType.create(type), FieldKey.create(field)),
      );

    return new ParticularsSpec(
      refs(declaration.applicantName),
      refs(declaration.propertyAddress),
      refs(declaration.cadastralNumber),
    );
  }

  // A profile that names none of the three: every submission under it is known
  // by its id alone, which is what a list of them can then say.
  static none(): ParticularsSpec {
    return new ParticularsSpec([], [], []);
  }

  get applicantName(): readonly FieldRef[] {
    return this.#applicantName;
  }

  get propertyAddress(): readonly FieldRef[] {
    return this.#propertyAddress;
  }

  get cadastralNumber(): readonly FieldRef[] {
    return this.#cadastralNumber;
  }

  // Every reference the three lists hold, in no particular order. What a reader
  // of the extracted fields needs to know is which of them could ever be a
  // particular — the ordering that decides between them is each list's own.
  get references(): readonly FieldRef[] {
    return [
      ...this.#applicantName,
      ...this.#propertyAddress,
      ...this.#cadastralNumber,
    ];
  }
}

/*
 * Whether a measure falls between the bounds a rule states about it. Inclusive
 * at the bottom, exclusive at the top, and null is an open end.
 *
 * A measure that could not be read is null, and a rule that has something to
 * say about that measure does not cover the case: guessing which side of a
 * threshold an unread figure falls on is the one thing this must never do. A
 * rule that says nothing about it covers the case anyway — a rule that holds
 * whatever the year is holds when nobody could read the year.
 */
function within(
  measure: number | null,
  from: number | null,
  below: number | null,
): boolean {
  if (from === null && below === null) return true;
  if (measure === null) return false;

  return (
    (from === null || measure >= from) && (below === null || measure < below)
  );
}

// Bounds as one line of an audit message, so a reader can see which rule was
// applied without opening the profile. Empty where the rule states neither.
function boundsSaid(
  from: number | null,
  below: number | null,
  write: (figure: number) => string,
): string {
  if (from !== null && below !== null) {
    return `${write(from)} to below ${write(below)}`;
  }
  if (from !== null) return `${write(from)} and above`;
  if (below !== null) return `below ${write(below)}`;

  return '';
}

/**
 * What a profile answers for at the counter, as the engine reads it: the
 * grounds it registers a right on, and the years it takes a case from.
 *
 * Every answer it gives is one criterion at a time and stated in words, because
 * the only thing it is ever used for is a recommendation somebody may overrule.
 * A suggestion an operator cannot argue with is one they can only obey or
 * distrust, and neither is what a picker with a default is for.
 */
export class IntakeSpec {
  readonly #grounds: readonly DocumentType[];

  private constructor(
    grounds: readonly DocumentType[],
    public readonly builtFrom: number | null,
    public readonly builtBefore: number | null,
  ) {
    this.#grounds = [...grounds];
  }

  static of(declaration: IntakeDeclaration): IntakeSpec {
    return new IntakeSpec(
      declaration.grounds.map(ground => DocumentType.create(ground)),
      declaration.builtFrom,
      declaration.builtBefore,
    );
  }

  // A profile that says nothing about what it takes in. It registers no ground
  // anybody can name, so no declaration ever points at it — which is the right
  // answer for a profile whose author has not said what it is for, and not the
  // same thing as a profile that takes everything.
  static none(): IntakeSpec {
    return new IntakeSpec([], null, null);
  }

  get grounds(): readonly DocumentType[] {
    return this.#grounds;
  }

  registers(basis: DocumentType): boolean {
    return this.#grounds.some(ground => ground.equals(basis));
  }

  // Whether a case of this year is one this profile takes. A year nobody
  // declared is null, and a profile bounded by no year answers for it — the
  // same reading a provision gives an unread figure.
  takesCaseFrom(year: number | null): boolean {
    return within(year, this.builtFrom, this.builtBefore);
  }

  // Whether this profile is bounded by a year at all. False on every profile
  // shipped today, and what lets a suggestion say plainly that the declared
  // year ruled nothing out instead of implying it weighed one.
  get isBoundedByYear(): boolean {
    return this.builtFrom !== null || this.builtBefore !== null;
  }

  // The years it answers for, as one line of the audit message.
  get years(): string {
    return boundsSaid(this.builtFrom, this.builtBefore, figure => `${figure}`);
  }

  // The grounds as one line of the audit message.
  get cited(): string {
    return this.#grounds.map(ground => ground.value).join(', ');
  }
}

export class DocumentTypeSpec {
  private constructor(
    public readonly type: DocumentType,
    public readonly description: string,
    public readonly hints: readonly string[],
    public readonly schema: FieldSchema,
    public readonly isRequired: boolean,
    // Whether the profile takes a paper of this type at any time, which is what
    // publishes a gap for it on a package that is short of nothing (COMM-80).
    public readonly isAlwaysAccepted: boolean,
    public readonly expectsStamp: boolean,
    public readonly expectsSignature: boolean,
    public readonly source: DocumentSource,
  ) {}

  static of(declaration: Declaration): DocumentTypeSpec {
    return new DocumentTypeSpec(
      DocumentType.create(declaration.key),
      declaration.description,
      [...declaration.hints],
      FieldSchema.of(
        declaration.fields.map(([key, label, note]) =>
          FieldSpec.of(key, label, note ?? null),
        ),
      ),
      declaration.required,
      declaration.alwaysAccepted,
      declaration.expectsStamp,
      declaration.expectsSignature,
      declaration.source,
    );
  }

  // An entry of the document catalogue: something the envelopes carry that no
  // profile asks for. Shaped like a profile's own type because whoever
  // classifies chooses between the two lists at once — but required of nothing
  // and declaring no fields, so nothing is extracted from it and nothing counts
  // it as missing (ADR-0012).
  // No profile asks for the paper, so no profile asks it to be attested
  // either: an unsigned courier waybill is not a shortfall in the package.
  static catalogued(declaration: CatalogueDeclaration): DocumentTypeSpec {
    return new DocumentTypeSpec(
      DocumentType.create(declaration.key),
      declaration.description,
      [...declaration.hints],
      FieldSchema.none(),
      false,
      // No profile asks for it, so there is no gap to offer it against either.
      false,
      false,
      false,
      // Nothing is asked of it, so nothing is asked of any system about it.
      'Package',
    );
  }

  // A type the active profile says nothing about — a document classified under
  // a profile this package was not opened with, or under one this build has
  // since changed. It declares no fields, so nothing is extracted from it and
  // nothing counts it as missing.
  static unrecognised(type: DocumentType): DocumentTypeSpec {
    return new DocumentTypeSpec(
      type,
      '',
      [],
      FieldSchema.none(),
      false,
      false,
      false,
      false,
      'Package',
    );
  }
}

/*
 * The fields the acceptance contract asks of the papers its provisions name
 * (block `DOCFIELDS`), by kind of paper. Held apart from the declarations
 * because several kinds share one set: every title document is read for the
 * same lines, whatever office issued it (ADR-0025).
 */
type Fields = Declaration['fields'];

const QR_NOTE =
  'only the text the sheet prints for the code — the link or the reference ' +
  'under or beside it. Never read the picture of the code itself: a decoded ' +
  'guess is a value nobody can check against the paper.';

const HEIGHT_NOTE =
  'the height marked on the section from the ±0.000 datum to the underside of ' +
  'the covering of the top storey (UPCC 80.1). Not the ridge, not the parapet ' +
  'and not the absolute mark.';

const SPAN_NOTE =
  'the axis spacings dimensioned on the floor plans, as printed, separated by ' +
  'semicolons.';

// What every title to the land is read for.
const TITLE_FIELDS: Fields = [
  ['document_no', 'Number of the document'],
  [
    'issue_date',
    'Date of the document',
    'the date the document was issued or the decision taken. A title is a ' +
      'title only within a window of dates, and this is the date the window ' +
      'is held against.',
  ],
  [
    'issuing_authority',
    'Issuing authority',
    'the body that issued the document, as the document names it.',
  ],
  [
    'holder_name',
    'Surname, name and patronymic of the person',
    'the person the right is granted to, as the document names them.',
  ],
  ['property_address', 'Address of the object'],
  [
    'plot_area',
    'Size of the land plot',
    'the size of the plot as the document states it, with its unit.',
  ],
];

// A Soviet-era title is kept in the National Archive Fund, and the contract asks
// of it where: the item of the Decree it is a ground under, the fond, the
// inventory, the file and the sheet, and the QR code an archival reference
// carries.
const DECREE_439_FIELDS: Fields = [
  ...TITLE_FIELDS,
  [
    'decree_item',
    'Item number under Decree 439 (classification)',
    'the point of the Decree No. 439 list the document states it is issued ' +
      'under, where it states one. Do not classify the document yourself.',
  ],
  ['archive_reference', 'Archive fond, inventory, file and sheet'],
  ['qr_code', 'QR code', QR_NOTE],
];

const REGISTER_EXTRACT_FIELDS: Fields = [
  ['holder_name', 'Person whose right is formalised'],
  ['property_type', 'Type of immovable property'],
  [
    'property_address',
    'Address and former address',
    'the address of the property, and the former address where the extract ' +
      'prints one, as one value.',
  ],
  ['ownership_type', 'Ownership type of the land plot'],
  [
    'right_type',
    'Type of right over the land plot',
    'the right itself — ownership, use, lease — as the extract names it.',
  ],
  [
    'land_category',
    'Category of the land plot',
    'the designated purpose of the land, as the category field of the extract ' +
      'words it.',
  ],
  [
    'plot_area',
    'Size of the land plot',
    'with its unit, as printed — hectares on most extracts.',
  ],
  ['registry_no', 'Registry number'],
  [
    'rightholders',
    'Rightholders: name, share, registration number and date',
    'every rightholder the extract lists, each with their share and the ' +
      'number and date of the registration, separated by semicolons.',
  ],
  ['issue_date', 'Date of the extract'],
  ['qr_code', 'QR code', QR_NOTE],
];

const APPROVED_DESIGN_FIELDS: Fields = [
  ['designer_name', 'Design organisation'],
  [
    'approving_authority',
    'Authority that approved the design',
    'the executive authority whose approval or agreement the design carries.',
  ],
  ['approval_date', 'Date of approval'],
  ['property_address', 'Property address'],
  ['project_name', 'Name of the object'],
  ['storeys', 'Storeys above ground'],
  ['building_height', 'Building height', HEIGHT_NOTE],
  ['span_dimensions', 'Span dimensions', SPAN_NOTE],
];

const ACCEPTANCE_ACT_FIELDS: Fields = [
  ['approving_authority', 'Authority approving the act'],
  ['decision_no', 'Number of the decision approving the act'],
  [
    'act_date',
    'Date of the act',
    'the date the act was signed or approved — the date the building was ' +
      'accepted as finished.',
  ],
  ['property_address', 'Address of the object'],
  ['project_name', 'Name of the object'],
  ['client_name', 'Client (legal or natural person)'],
  [
    'commission',
    'Chair and members of the acceptance commission',
    'every member the act names, the chair first, separated by semicolons.',
  ],
  ['contractor_representative', 'Representative of the contractor'],
];

const PERMIT_FIELDS: Fields = [
  ['decision_no', 'Number of the permit or decision'],
  ['decision_date', 'Date of the permit or decision'],
  ['issuing_authority', 'Issuing authority'],
  ['property_address', 'Address of the object'],
  ['client_name', 'Client'],
];

const OPERATION_PERMIT_FIELDS: Fields = [
  ['permit_no', 'Number of the permit'],
  [
    'permit_date',
    'Date of the permit',
    'the date the permit for operation was issued — the date the building was ' +
      'let into use.',
  ],
  ['issuing_authority', 'Issuing authority'],
  ['property_address', 'Address of the object'],
  [
    'object_parameters',
    'Parameters of the object',
    'the parameters of the object the permit states — storeys, areas, height ' +
      '— as it words them.',
  ],
];

const PLANNING_SECTION_FIELDS: Fields = [
  ['designer_name', 'Design organisation'],
  ['designer_tax_id', 'Taxpayer number of the design organisation'],
  ['licence_no', 'Design licence number stated on the document'],
  [
    'project_composition',
    'Composition of the section',
    'which drawings the section is composed of — plans, sections, elevations, ' +
      'site plan — separated by semicolons.',
  ],
  ['property_address', 'Property address'],
  ['storeys', 'Storeys above ground'],
  ['building_height', 'Building height', HEIGHT_NOTE],
  ['span_dimensions', 'Span dimensions', SPAN_NOTE],
];

const NOTICE_FIELDS: Fields = [
  [
    'addressee_authority',
    'Addressee authority',
    'the city or district executive authority the notification is addressed to.',
  ],
  ['applicant_name', 'Name of the applicant'],
  ['property_address', 'Address of the object'],
  ['plot_area', 'Size of the land plot'],
  ['building_type', 'Type of building'],
  [
    'notice_date',
    'Date of the notification',
    'the date the notification was signed or sent — the date construction is ' +
      'stated to be finished.',
  ],
];

const LICENCE_FIELDS: Fields = [
  ['licence_no', 'Registration number of the licence'],
  ['licence_date', 'Date of the licence'],
  ['issuing_authority', 'Issuing authority'],
  ['activity_type', 'Type of activity'],
  ['licensee_name', 'Licensee'],
  ['licensee_address', 'Address of the licensee'],
  ['licensee_tax_id', 'Taxpayer number of the licensee'],
  ['signing_official', 'Signing official'],
];

export class VerificationProfile {
  // The one case the system handles: first state registration of an individual
  // residential house. The key is what every stored package names its policy
  // by, so it outlives the wording — the profile's name is a UI string in three
  // languages, not this.
  //
  // Two of its types are required of every package — the plan of the plot and
  // the sketch design (Articles 10.2.2 and 10.2.3). Which of the rest a
  // package must carry is decided by the provision of Article 8 its case falls
  // under (ADR-0025); every other paper is read where it arrives.
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
        // Retrieved from MQS where the registry reaches it, and read off the
        // envelope where it does not — which, with MQS not connected, is always.
        // Required of every package whatever its provision (Article 10.2.2).
        required: true,
        alwaysAccepted: false,
        // Drawn and issued by the cadastre office: the surveyed figures are
        // its own, and it is the office's seal and the surveyor's hand that say
        // so (ADR-0012).
        expectsStamp: true,
        expectsSignature: true,
        source: 'Mqs',
        // The eleven items the acceptance contract asks of a plan-scheme, in
        // the order it numbers them. Sixteen keys and not eleven: four of its
        // items name two values apiece — the ownership and the right, the
        // documentary area and the surveyed one, the date and the scale, the
        // issuing office and the QR code — and each of those is a value of its
        // own or it cannot be read. The parcel's cadastral number is no item of
        // the contract at all; it was here first, the cross-check and the
        // registry check are asked under it, and it stays beside the address it
        // identifies.
        fields: [
          ['property_address', 'Property address'],
          ['cadastral_number', 'Cadastral number'],
          ['owner_name', 'Rightholder'],
          ['land_category', 'Land category (designated purpose)'],
          [
            'ownership_type',
            'Ownership type',
            'the form of ownership the parcel is held in — private, state, ' +
              'municipal — and not the right exercised over it.',
          ],
          [
            'right_type',
            'Type of right',
            'the right itself — ownership, use, lease — as the plan names it.',
          ],
          [
            'registry_no',
            'Registry record number',
            'the number of the register entry this plan was drawn from. It is ' +
              'not the cadastral number of the parcel: where the sheet prints ' +
              'both, they are two different values.',
          ],
          [
            'plot_area',
            'Plot area per the document',
            'the area the document states for the parcel. Where the sheet ' +
              'prints a documentary area and an actual one side by side, this ' +
              'is the documentary figure.',
          ],
          [
            'actual_area',
            'Actual plot area',
            'the surveyed area as measured on the ground, where the sheet ' +
              'prints it apart from the documentary one. Never repeat the ' +
              'documentary figure here: a sheet that states one area states ' +
              'one area.',
          ],
          [
            'easements',
            'Easements',
            'the encumbrances the plan records over the parcel. A plan that ' +
              'prints "none" states none, and that is a value; a plan that ' +
              'says nothing at all carries no value.',
          ],
          [
            'turning_points',
            'Principal turning points (X, Y) and the distances between them',
            'every principal turning point the plan lists, in the order it ' +
              'lists them, each with its X and Y and the distance to the ' +
              'next. Give them as one value, the points separated by ' +
              'semicolons. Do not compute a distance the plan does not print.',
          ],
          ['plan_basis', 'Basis for drawing up the plan'],
          ['plan_date', 'Plan date'],
          ['plan_scale', 'Scale of the plan'],
          [
            'issuing_authority',
            'Issuing authority',
            'the territorial office that issued the plan.',
          ],
          [
            'qr_code',
            'QR code',
            'only the text the sheet prints for the code — the link or the ' +
              'reference under or beside it. Never read the picture of the ' +
              'code itself: a decoded guess is a value nobody can check ' +
              'against the paper.',
          ],
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
        // A title document and one of many: every provision asks for a title,
        // and any of them answers it (Article 10.2.1, ADR-0025).
        required: false,
        alwaysAccepted: false,
        // An act of an executive authority. An extract of one is issued by
        // the same authority and attested the same way.
        expectsStamp: true,
        expectsSignature: true,
        source: 'Package',
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
        // Not a shortfall at submission: the state duty is paid once the
        // application has been approved (acceptance contract, 10.2.4).
        required: false,
        // The one paper of this profile an operator may send in whenever they
        // have it, package complete or not: the duty is paid outside this
        // system, at a counter or a terminal, and a slip that turns up after
        // the submission — or a second one against a corrected amount — is an
        // ordinary event and not a shortfall (COMM-80).
        alwaysAccepted: true,
        // Neither mark. The duty is paid at a bank counter or a terminal and
        // the slip that comes back is printed, not sealed; requiring a stamp
        // here would report every correctly paid package as faulty (ADR-0012).
        expectsStamp: false,
        expectsSignature: false,
        source: 'Package',
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
          "Carries drawings, the designer's name and the areas, storeys and " +
          'height of what is proposed — the building, not the plot it stands ' +
          'on.',
        hints: [
          'eskiz layihəsi',
          'eskiz layihə',
          'эскизный проект',
          'эскизного проекта',
        ],
        // Required of every package whatever its provision: for an individual
        // house the technical document is the sketch design (Article 10.2.3).
        required: true,
        alwaysAccepted: false,
        // Produced and approved by a design organisation, which signs and
        // seals the title block of what it puts its name to.
        expectsStamp: true,
        expectsSignature: true,
        source: 'Package',
        // The twelve items the acceptance contract asks of a sketch design, in
        // the order it numbers them, several of which name two or three values
        // apiece. Its thirteenth item — the architect's and the director's
        // signature and the seal on every page — is not among them and is not a
        // field: it is the attestation of the paper, declared above as
        // `expectsStamp` / `expectsSignature` and reported as what was actually
        // seen (ADR-0012). The approval date is the other way round — no item
        // of the contract, and read off this paper since before there was one.
        fields: [
          [
            'designer_name',
            'Design organisation',
            'the name of the organisation that produced the design.',
          ],
          [
            'designer_tax_id',
            'Taxpayer number of the design organisation',
            'the VÖEN / ИНН of the design organisation, usually printed with ' +
              'its name in the title block.',
          ],
          ['designer_director', 'Director of the design organisation'],
          ['chief_architect', 'Chief architect of the design'],
          ['client_name', 'Client'],
          ['property_address', 'Property address'],
          ['project_name', 'Name of the object'],
          [
            'drawing_schedule',
            'Drawing schedule',
            'the schedule of drawings as the set lists it — the sheet marks ' +
              'and what each sheet holds. Give it as one value, the entries ' +
              'separated by semicolons.',
          ],
          [
            'sheet_count',
            'Number of sheets',
            'the number of sheets the set states for itself. Do not count the ' +
              'sheets you were given: a set may be handed in incomplete, and ' +
              'the figure the inspector needs is the one the paper claims.',
          ],
          [
            'project_composition',
            'Composition of the set',
            'which drawings the set is composed of — location plan, site ' +
              'plan, floor plans, roof plan, section, elevations — as it ' +
              'names them, separated by semicolons.',
          ],
          [
            'built_up_area',
            'Built-up area',
            'the footprint of the building, from the technical and economic ' +
              'indicators. Not the total area and not the area of the parcel.',
          ],
          ['total_area', 'Total area'],
          [
            'building_volume',
            'Building volume',
            'the building volume of the technical and economic indicators — ' +
              'a volume in m³, never an area.',
          ],
          [
            'storeys',
            'Storeys',
            'the number of storeys. Where the set does not state a figure, it ' +
              'is the number of floor plans the drawing set contains — the ' +
              'contract reads the storeys off them.',
          ],
          [
            'datum_level',
            'Definition of the ±0.000 datum',
            'how the set defines ±0.000 — the floor level of the first ' +
              'storey — as the sheet words it, with the absolute mark where ' +
              'one is given.',
          ],
          // Read for its own sake and for the table of provisions: which
          // provision of Article 8 the case falls under turns on how tall the
          // building is, and the design is the paper that says (ADR-0025).
          [
            'building_height',
            'Building height',
            'the height marked on the section from the ±0.000 datum to the ' +
              'underside of the covering of the top storey (UPCC 80.1). Not ' +
              'the ridge, not the parapet and not the absolute mark: where ' +
              'several heights are marked, this is the one meant.',
          ],
          [
            'span_dimensions',
            'Span dimensions',
            'the axis spacings dimensioned on the floor plans, as printed, ' +
              'separated by semicolons.',
          ],
          ['project_scale', 'Scale of the drawings'],
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
        // Asked for by no provision. Read where it arrives, and one side of the
        // checks that name it (ADR-0025).
        required: false,
        alwaysAccepted: false,
        // What an archive issues over its own seal. Unsealed it states
        // nothing: the whole worth of the certificate is which office says it.
        expectsStamp: true,
        expectsSignature: true,
        source: 'NationalArchive',
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
        // Not among the papers the acceptance contract asks for. Read where it
        // arrives, and one side of the checks that name it (ADR-0025).
        required: false,
        alwaysAccepted: false,
        // Signed and not sealed: it is written by a natural person, who has no
        // seal to press. The signature is what makes it their application.
        expectsStamp: false,
        expectsSignature: true,
        source: 'Package',
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
        // The registry takes the applicant's identity from IAMAS through EHİS
        // and MQS, not off a scan; a card in the envelope is read and checked
        // against the application, and is required of nobody (ADR-0025).
        required: false,
        alwaysAccepted: false,
        // Neither. Its security features are printed into the card and the
        // reader marks them [photo], not [stamp]; a passport's specimen
        // signature is on a page the package need not carry (ADR-0012).
        expectsStamp: false,
        expectsSignature: false,
        source: 'Mqs',
        fields: [
          ['first_name', 'First name'],
          ['last_name', 'Last name'],
          ['document_no', 'Document number'],
          ['issue_date', 'Issue date'],
          ['expiry_date', 'Expiration date'],
        ],
      },
      // ── What a provision of Article 8 asks for (ADR-0025) ─────────────────
      // Required of no package as such: which of them a package must carry is
      // decided by the provision its case falls under, not by the profile.
      // Moved here out of the statutory catalogue, where a paper was named and
      // never read (ADR-0022): a paper a requirement is answered by is a paper
      // the engine has to read.
      {
        key: 'approved_design',
        description:
          'Construction design of the house approved by, or agreed with, the ' +
          'local executive authority, and carrying that approval — the design a ' +
          'building raised before 2013 was permitted on (Articles 8.0.9.1.1, ' +
          '8.0.9.2). The approval of an authority is what makes it this paper: ' +
          "the designer's own sketch design carries none.",
        hints: [
          'təsdiq edilmiş layihə',
          'razılaşdırılmış layihə',
          'утверждённый проект',
          'согласованный проект',
        ],
        required: false,
        alwaysAccepted: false,
        // Approved by an authority, over its seal, and signed by the designer.
        expectsStamp: true,
        expectsSignature: true,
        source: 'Package',
        fields: APPROVED_DESIGN_FIELDS,
      },
      {
        key: 'operation_acceptance_act',
        description:
          'Act accepting a completed building into operation, issued by the local ' +
          'executive authority for buildings raised before 1 January 2013 ' +
          '(Article 8.0.9). It closes the construction; a permit to occupy issued ' +
          'under the later Code is a different paper.',
        hints: [
          'istismara qəbul aktı',
          'yaşayış evinin istismara qəbul aktı',
          'акт приёмки в эксплуатацию',
          'акт приёмки жилого дома в эксплуатацию',
        ],
        required: false,
        alwaysAccepted: false,
        expectsStamp: true,
        expectsSignature: true,
        source: 'Package',
        fields: ACCEPTANCE_ACT_FIELDS,
      },
      {
        key: 'construction_permit_decision',
        description:
          'Decision of the relevant executive authority permitting a building to ' +
          'be constructed (Articles 8.0.9.2, 8.0.10.1). It permits work that has ' +
          'not started; it says nothing about a finished building.',
        hints: [
          'tikilinin inşa edilməsinə icazə barədə qərar',
          'tikintiyə icazə barədə qərar',
          'tikinti icazəsi',
          'решение о разрешении на строительство',
          'разрешение на строительство',
        ],
        required: false,
        alwaysAccepted: false,
        expectsStamp: true,
        expectsSignature: true,
        source: 'UrbanPlanningCommittee',
        fields: PERMIT_FIELDS,
      },
      {
        key: 'architectural_planning_section',
        description:
          'Architectural and planning section of a construction design, required ' +
          'of objects that need a permit and of those under the notification ' +
          'procedure (Articles 8.0.10.1, 8.0.10.2). It is a section OF an ' +
          "approved design, not the designer's sketch design of the house.",
        hints: [
          'layihənin memarlıq-planlaşdırma bölməsi',
          'memarlıq-planlaşdırma bölməsi',
          'архитектурно-планировочный раздел проекта',
          'архитектурно-планировочная часть проекта',
        ],
        required: false,
        alwaysAccepted: false,
        expectsStamp: true,
        expectsSignature: true,
        source: 'Package',
        fields: PLANNING_SECTION_FIELDS,
      },
      {
        key: 'operation_permit',
        description:
          'Permit to put a completed object into operation, issued under the ' +
          'Urban Planning and Construction Code (Articles 8.0.10.1, 8.0.10-1). ' +
          'A permit granted by an authority, not an acceptance act signed by a ' +
          'commission.',
        hints: [
          'istismara icazə',
          'obyektin istismarına icazə',
          'разрешение на эксплуатацию',
        ],
        required: false,
        alwaysAccepted: false,
        expectsStamp: true,
        expectsSignature: true,
        source: 'UrbanPlanningCommittee',
        fields: OPERATION_PERMIT_FIELDS,
      },
      {
        key: 'construction_completion_notice',
        description:
          'The notification an owner sends the authority once construction under ' +
          'the notification procedure is finished (Article 8.0.10.2). It is sent ' +
          'BY the owner; nothing is granted by it.',
        hints: [
          'tikintinin başa çatması barədə məlumat',
          'məlumatlandırma icraatı barədə bildiriş',
          'уведомление о завершении строительства',
          'информация о завершении строительства',
        ],
        required: false,
        alwaysAccepted: false,
        expectsStamp: false,
        expectsSignature: true,
        source: 'UrbanPlanningCommittee',
        fields: NOTICE_FIELDS,
      },
      {
        key: 'designer_licence',
        description:
          'The licence of the design organisation that drew the sketch design, ' +
          'or the annex listing what the licence permits. It is the firm that ' +
          'is licensed, never the property.',
        hints: [
          'lisenziya',
          'lisenziyaya əlavə',
          'lisenziyanın əlavəsi',
          'лицензия',
        ],
        required: false,
        alwaysAccepted: false,
        expectsStamp: true,
        expectsSignature: true,
        source: 'LicencesPortal',
        fields: LICENCE_FIELDS,
      },
      // ── Title documents (Article 10.2.1, ADR-0025) ─────────────────────────
      // Any one of them answers the requirement every provision makes of a
      // title to the land. The table of provisions says which right each
      // confers and the window of dates it is a title in; the order allotting
      // the parcel, declared above, is one of them.
      {
        key: 'state_register_extract',
        description:
          'Extract from the State Register of Immovable Property: what the ' +
          'register already holds about the property, under an extract number and ' +
          'a date. It reports a registration that has happened; it is not a ' +
          'ground for making one.',
        hints: [
          'daşınmaz əmlakın dövlət reyestrindən çıxarış',
          'выписка из государственного реестра недвижимого имущества',
          'выписка из реестра недвижимого имущества',
        ],
        required: false,
        alwaysAccepted: false,
        expectsStamp: false,
        expectsSignature: false,
        source: 'Mqs',
        fields: REGISTER_EXTRACT_FIELDS,
      },
      {
        key: 'land_right_state_act',
        description:
          'State act on the right of ownership, possession or use of a land plot, ' +
          "issued by a city or district soviet's executive committee (Decree " +
          'points 1.3 and 2.1). Headed "state act"; it is the plot it concerns, ' +
          'not a building on it.',
        hints: [
          'torpaqdan istifadə hüququna dair dövlət aktı',
          'torpaq sahəsinə dair dövlət aktı',
          'dövlət aktı',
          'государственный акт на право пользования землёй',
          'государственный акт на землю',
        ],
        required: false,
        alwaysAccepted: false,
        expectsStamp: true,
        expectsSignature: true,
        source: 'NationalArchive',
        fields: DECREE_439_FIELDS,
      },
      {
        key: 'soviet_land_record',
        description:
          'Land record issued by the economic department, or by the technical ' +
          'inventory bureau (BTI), of the executive committee of a local soviet ' +
          '(Decree points 1.1 and 1.2). A register entry about a plot, from the ' +
          'Soviet era.',
        hints: [
          'torpaq qeydləri',
          'torpaq qeydi',
          'земельные записи',
          'земельная запись',
        ],
        required: false,
        alwaysAccepted: false,
        expectsStamp: true,
        expectsSignature: true,
        source: 'NationalArchive',
        fields: DECREE_439_FIELDS,
      },
      {
        key: 'land_allocation_decision',
        description:
          "Decision of a soviet of workers' or people's deputies allotting land " +
          'plots — Soviet-era under Decree point 1.4, and between 9 November 1991 ' +
          'and 19 December 1995 under point 2.2. The two points are the same ' +
          'paper in two periods.',
        hints: [
          'torpaq sahələrinin ayrılması barədə qərar',
          'torpaq sahəsinin ayrılması haqqında qərar',
          'решение об отводе земельных участков',
          'решение о выделении земельного участка',
        ],
        required: false,
        alwaysAccepted: false,
        expectsStamp: true,
        expectsSignature: true,
        source: 'NationalArchive',
        fields: DECREE_439_FIELDS,
      },
      {
        key: 'notarised_land_allocation_contract',
        description:
          'Notarised contract allotting a land plot for the construction of a ' +
          'dwelling under personal ownership, concluded after 26 August 1948 ' +
          '(Decree point 1.6). It allots the plot rather than granting a right to ' +
          'build on somebody else’s.',
        hints: [
          'yaşayış evlərinin tikintisi üçün torpaq sahələrinin verilməsi haqqında müqavilə',
          'torpaq sahəsinin verilməsi haqqında notariat qaydasında təsdiq edilmiş müqavilə',
          'договор о предоставлении земельного участка для строительства жилого дома',
        ],
        required: false,
        alwaysAccepted: false,
        expectsStamp: true,
        expectsSignature: true,
        source: 'NationalArchive',
        fields: DECREE_439_FIELDS,
      },
      {
        key: 'household_book_extract',
        description:
          'Extract from a household registration book, or a certificate issued on ' +
          'the basis of such an extract, given before 1 January 2001 for houses ' +
          'built by that date (Decree point 2.3). Often produced as an archival ' +
          'EXTRACT — a copy of the book entry — rather than as a certificate an ' +
          'archive writes in its own words.',
        hints: [
          'təsərrüfatbaşına kitabından çıxarış',
          'təsərrüfat kitabından çıxarış',
          'arxiv çıxarışı',
          'выписка из похозяйственной книги',
          'архивная выписка',
        ],
        required: false,
        alwaysAccepted: false,
        expectsStamp: true,
        expectsSignature: true,
        source: 'NationalArchive',
        fields: DECREE_439_FIELDS,
      },
      {
        key: 'technical_passport',
        description:
          'Technical passport of a building drawn up by the technical inventory ' +
          'bodies: the storeys, rooms, areas and year of a house, with its ' +
          'measured drawings. Where it was drawn up before 1 January 2001 and ' +
          'states the size of the adjoining plot it is itself a ground under ' +
          'Decree point 2.4. It describes what stands; it does not grant anything.',
        hints: [
          'texniki pasport',
          'texniki pasportlar',
          'yaşayış evinə dair texniki pasport',
          'технический паспорт',
          'технические паспорта',
        ],
        required: false,
        alwaysAccepted: false,
        expectsStamp: true,
        expectsSignature: true,
        source: 'NationalArchive',
        fields: DECREE_439_FIELDS,
      },
      {
        key: 'kolkhoz_allocation_decision',
        description:
          'Decision of the general meeting of the members of a collective farm ' +
          '(kolkhoz), or of their delegates, allotting homestead land plots for ' +
          'the construction of dwellings and garden houses (Decree point 2.5).',
        hints: [
          'kolxoz üzvlərinin ümumi yığıncağının qərarı',
          'kolxoz üzvlərinin yığıncağının qərarı',
          'решение общего собрания членов колхоза',
        ],
        required: false,
        alwaysAccepted: false,
        expectsStamp: true,
        expectsSignature: true,
        source: 'NationalArchive',
        fields: DECREE_439_FIELDS,
      },
      {
        key: 'bound_land_book_extract',
        description:
          'Extract from the bound (laced) land books kept by a kolkhoz or a ' +
          'sovkhoz about a homestead plot (Decree points 2.5 and 2.5-1). A copy ' +
          'of a farm register entry, not of a household registration book.',
        hints: [
          'qaytanlanmış torpaq kitabından çıxarış',
          'torpaq kitabından çıxarış',
          'выписка из прошнурованной земельной книги',
          'выписка из земельной книги',
        ],
        required: false,
        alwaysAccepted: false,
        expectsStamp: true,
        expectsSignature: true,
        source: 'NationalArchive',
        fields: DECREE_439_FIELDS,
      },
      {
        key: 'sovkhoz_allocation_order',
        description:
          'Order of the head of a state farm (sovkhoz) or of another ' +
          'state-subordinated agricultural enterprise allotting a homestead plot ' +
          '(Decree point 2.5-1). One manager signs it, where the kolkhoz answer ' +
          'is a meeting of members.',
        hints: [
          'sovxoz rəhbərinin əmri',
          'kənd təsərrüfatı müəssisəsi rəhbərinin əmri',
          'приказ руководителя совхоза',
          'распоряжение главы совхоза',
        ],
        required: false,
        alwaysAccepted: false,
        expectsStamp: true,
        expectsSignature: true,
        source: 'NationalArchive',
        fields: DECREE_439_FIELDS,
      },
      {
        key: 'homestead_land_allocation_decision',
        description:
          'Decision allotting a homestead land plot for the construction of a ' +
          'dwelling, taken before 1 January 2001 by the representative of the ' +
          'local executive authority for an administrative-territorial unit ' +
          '(Decree point 2.7).',
        hints: [
          'həyətyanı torpaq sahəsinin ayrılması barədə qərar',
          'həyətyanı torpaq sahəsinin verilməsi barədə qərar',
          'решение об отводе приусадебного земельного участка',
        ],
        required: false,
        alwaysAccepted: false,
        expectsStamp: true,
        expectsSignature: true,
        source: 'NationalArchive',
        fields: DECREE_439_FIELDS,
      },
      {
        key: 'apartment_demolition_decision',
        description:
          'Decision of a local executive authority to demolish dwelling-type ' +
          'flats and raise an individual dwelling in their place, produced with ' +
          'the design agreed with that authority (Decree point 2.8).',
        hints: [
          'mənzillərin sökülərək fərdi yaşayış evinin inşası barədə qərar',
          'mənzillərin sökülməsi barədə qərar',
          'решение о сносе квартир и строительстве индивидуального жилого дома',
        ],
        required: false,
        alwaysAccepted: false,
        expectsStamp: true,
        expectsSignature: true,
        source: 'NationalArchive',
        fields: DECREE_439_FIELDS,
      },
      {
        key: 'registration_certificate',
        description:
          'Registration certificate confirming a right over immovable property, ' +
          'issued by an executive authority up to 6 July 2006 (Article 8.0.5) — ' +
          'the booklet the technical inventory bureaus issued, often produced ' +
          'together with a technical passport. It records an existing right; it ' +
          'is not the inventory passport itself.',
        hints: ['qeydiyyat vəsiqəsi', 'регистрационное удостоверение'],
        required: false,
        alwaysAccepted: false,
        expectsStamp: true,
        expectsSignature: true,
        source: 'Package',
        fields: TITLE_FIELDS,
      },
      {
        key: 'property_right_certificate',
        description:
          'Act or certificate confirming a right over immovable property, issued ' +
          'by an executive authority: up to 6 July 2006 under Article 8.0.5, and ' +
          'between 6 July 2006 and 24 June 2009 under Article 8.0.12. The two ' +
          'articles name the same paper in two windows, so the date decides which ' +
          'ground it is and never whether the document is this one.',
        hints: [
          'daşınmaz əmlaka dair şəhadətnamə',
          'daşınmaz əmlak üzərində hüquqları təsdiq edən şəhadətnamə',
          'mülkiyyət hüququna dair şəhadətnamə',
          'свидетельство на недвижимое имущество',
          'свидетельство о праве собственности на недвижимое имущество',
        ],
        required: false,
        alwaysAccepted: false,
        expectsStamp: true,
        expectsSignature: true,
        source: 'Package',
        fields: TITLE_FIELDS,
      },
      {
        key: 'state_property_disposal_act',
        description:
          'Act of an executive authority or a municipality alienating, leasing, ' +
          'granting the use of or mortgaging immovable property owned by the ' +
          'state or by a municipality — a municipal sale-purchase act and the ' +
          'like (Article 8.0.1). It disposes of property the state owns; it is ' +
          'not the executive order allotting an applicant a parcel to build on.',
        hints: [
          'bələdiyyənin alqı-satqı aktı',
          'daşınmaz əmlakın özgəninkiləşdirilməsinə dair akt',
          'özgəninkiləşdirmə aktı',
          'акт купли-продажи муниципалитета',
          'акт об отчуждении недвижимого имущества',
        ],
        required: false,
        alwaysAccepted: false,
        expectsStamp: true,
        expectsSignature: true,
        source: 'Package',
        fields: TITLE_FIELDS,
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
        // The plan-scheme first: it is the surveyed drawing of this parcel, and
        // the address on it was written by the office that surveyed it. Then
        // the sketch design, drawn against that plan. The application last —
        // it is filled in by hand, and it is where the reading went wrong in
        // both of the real submissions this profile has been run against.
        subject: [
          ['land_plot_plan', 'property_address'],
          ['sketch_project', 'property_address'],
          ['application', 'property_address'],
        ],
        attributes: [
          // The owner the archive certificate names against the right holder of
          // record — the one attribute the 2008 transfer of cases between the
          // Absheron and Baku offices is known to have changed.
          ['ownerName', 'archive_certificate', 'owner_name'],
          ['cadastralNumber', 'land_plot_plan', 'cadastral_number'],
          ['plotArea', 'land_plot_plan', 'plot_area'],
        ],
        // The three the archive files a case under, in its own words. Only
        // three, because the archive keeps what a case was decided on and not
        // what the applicant paid or who they are: there is no column for a
        // receipt or an identity card in any of the presence registers, and
        // asking about one would produce silence that reads as an answer.
        documents: [
          ['Ərizə', 'application'],
          ['Sərəncam çıxarışı', 'disposal_order'],
          ['Arayış', 'archive_certificate'],
          // The title documents the archive's registers keep a column for, under
          // the registers' own words: the Land Committee's state acts, the
          // technical inventory's passports, the State Property Committee's
          // certificates and contracts. Which section of the archive a title is
          // looked for in is decided by its kind (ADR-0025); a title only asked
          // about when the package carries it.
          ['Dövlət aktı', 'land_right_state_act'],
          ['Texniki Pasport', 'technical_passport'],
          ['Şəhadətnamə', 'property_right_certificate'],
          ['Müqavilə', 'state_property_disposal_act'],
        ],
      },
    ],
    // What a case of this kind is called: the applicant, the address and the
    // parcel, off the papers this profile believes them from.
    {
      // The application is the applicant's own statement of who they are, and
      // the name the case is filed under. Then the order that allotted the
      // land, then the two papers that name a right holder rather than an
      // applicant — the same person on an ordinary case, and the fallback when
      // the application's name line went unread. The identity card is not here
      // and cannot be: it prints a surname and a given name in two fields, and
      // a name assembled out of two readings is a value no document states.
      applicantName: [
        ['application', 'applicant_name'],
        ['disposal_order', 'applicant_name'],
        ['archive_certificate', 'owner_name'],
        ['land_plot_plan', 'owner_name'],
      ],
      // The plan-scheme first and the application last, which is the order
      // `property_of_record` asks the register in and for the same reason: the
      // address on the plan was written by the office that surveyed the parcel,
      // and the one on the application is filled in by hand and is where the
      // reading went wrong in both of the real submissions (ADR-0010). The row
      // and the register therefore name the same address wherever both have
      // one, which is what makes the two readable side by side.
      propertyAddress: [
        ['land_plot_plan', 'property_address'],
        ['sketch_project', 'property_address'],
        ['disposal_order', 'property_address'],
        ['archive_certificate', 'property_address'],
        ['application', 'property_address'],
      ],
      // The surveyed drawing states the parcel; the application states what the
      // applicant wrote down. That is the order the cross-check names them in
      // too.
      cadastralNumber: [
        ['land_plot_plan', 'cadastral_number'],
        ['application', 'cadastral_number'],
      ],
    },
    // What this profile answers for at the counter: a right founded on any title
    // to the land the table of provisions lists (ADR-0025). The order allotting
    // the parcel was the only ground while the required set was one flat list;
    // it is one title among several now.
    //
    // No year bounds: which provision a case falls under turns on the year, but
    // which profile governs it does not.
    {
      grounds: ARTICLE_8_PROVISIONS.titleDocuments
        .map(entry => entry.type)
        .filter((type, index, all) => all.indexOf(type) === index),
      builtFrom: null,
      builtBefore: null,
    },
    // Which provision of Article 8 a case falls under, and what it asks for.
    ARTICLE_8_PROVISIONS,
  );

  readonly #specs: readonly DocumentTypeSpec[];
  readonly #crossChecks: readonly CrossCheckSpec[];
  readonly #registryChecks: readonly RegistryCheckSpec[];
  readonly #particulars: ParticularsSpec;
  readonly #intake: IntakeSpec;
  readonly #provisions: ProvisionsSpec | null;

  private constructor(
    public readonly key: string,
    declarations: readonly Declaration[],
    crossChecks: readonly CrossCheckDeclaration[],
    registryChecks: readonly RegistryCheckDeclaration[] = [],
    particulars: ParticularsDeclaration | null = null,
    intake: IntakeDeclaration | null = null,
    provisions: ProvisionsDeclaration | null = null,
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
    this.#particulars = particulars
      ? ParticularsSpec.of(particulars)
      : ParticularsSpec.none();
    this.#intake = intake ? IntakeSpec.of(intake) : IntakeSpec.none();

    this.#provisions = provisions ? ProvisionsSpec.of(provisions) : null;

    VerificationProfile.guardGroundsAreDeclared(key, this.#specs, this.#intake);
    VerificationProfile.guardProvisionsAreDeclared(
      key,
      this.#specs,
      this.#provisions,
    );
  }

  // Every paper the table of provisions names — a title, a paper a provision
  // asks for, a paper a figure is read off — is one of this profile's types,
  // and every field it reads is one that type declares. Checked at import
  // time, for the reason the grounds are: a requirement no document could ever
  // be classified as would be a requirement no package could ever answer.
  private static guardProvisionsAreDeclared(
    key: string,
    specs: readonly DocumentTypeSpec[],
    provisions: ProvisionsSpec | null,
  ): void {
    if (!provisions) return;

    const specFor = (type: DocumentType): DocumentTypeSpec => {
      const found = specs.find(spec => spec.type.equals(type));

      if (!found) throw new DocumentTypeNotInProfileException(type.value, key);

      return found;
    };

    const figures = [
      ...provisions.builtIn,
      ...provisions.storeys,
      ...provisions.height,
      ...provisions.span,
      ...provisions.purpose,
      ...provisions.landRight,
      ...provisions.titleDocuments.map(entry => ({
        type: entry.type,
        key: entry.dateField,
      })),
    ];

    for (const at of figures) {
      if (!specFor(at.type).schema.declares(at.key)) {
        throw new FieldNotInSchemaException(at.key.value, at.type.value);
      }
    }

    for (const rule of provisions.rules) {
      for (const requirement of rule.requirements) {
        requirement.anyOf.forEach(specFor);
      }
    }
  }

  // A ground is offered to the operator as one of this profile's papers, so it
  // has to be one: a key nothing downstream reads would put a choice on the
  // intake screen that no run could ever act on. Checked when the profile is
  // built, which is at import time — a profile that names a ground it does not
  // declare takes the process down on start-up rather than at the counter.
  private static guardGroundsAreDeclared(
    key: string,
    specs: readonly DocumentTypeSpec[],
    intake: IntakeSpec,
  ): void {
    for (const ground of intake.grounds) {
      if (!specs.some(spec => spec.type.equals(ground))) {
        throw new DocumentTypeNotInProfileException(ground.value, key);
      }
    }
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

  /*
   * Which provision of Article 8 a case of this kind falls under, and what each
   * provision asks the package for (ADR-0025). Null on a profile whose required
   * set is the flat list its types declare.
   */
  get provisions(): ProvisionsSpec | null {
    return this.#provisions;
  }

  /*
   * Which of the values the pipeline read name a case of this kind, and off
   * which paper each is believed.
   *
   * Answered by every profile, including one that declares none: a register
   * that had to ask whether a profile has an opinion before it could draw a row
   * would be a register with an opinion of its own.
   */
  get particulars(): ParticularsSpec {
    return this.#particulars;
  }

  /*
   * What this profile takes in, in the terms the office declares a case in
   * before anything has been read: the grounds it registers a right on and the
   * years it answers for.
   *
   * The only thing a profile suggestion is decided on, and the only thing an
   * intake screen can offer a picker off. A profile that declares none takes
   * part in no suggestion — it is not a profile that answers for everything.
   */
  get intake(): IntakeSpec {
    return this.#intake;
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
