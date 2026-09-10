import {
  CrossCheckNotInProfileException,
  DocumentTypeNotInProfileException,
  RegistryCheckNotInProfileException,
  UnknownProfileException,
} from '../exceptions/index.js';

import { CrossCheckKey } from './cross-check.vo.js';
import { DocumentType } from './document-type.vo.js';
import { FieldSchema, FieldSpec } from './field-schema.vo.js';
import { FieldKey } from './field.vo.js';
import { RegistryCheckKey } from './registry-check.vo.js';
import { UNCONFIRMED_SUPPORTING_DOCUMENTS } from './supporting-documents.table.js';

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
  // Whether a paper of this kind is only itself once an office has sealed it,
  // and whether a hand has to have signed it. Stated per type and not once for
  // the profile: an applicant has no seal, and a bank terminal prints a receipt
  // that carries neither mark (ADR-0012). Both are declared on every type, so
  // that adding one is answering the question rather than forgetting it.
  readonly expectsStamp: boolean;
  readonly expectsSignature: boolean;
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
 * What the applicant has to bring beyond the envelope, and how the engine works
 * out which of several sets this case needs.
 *
 * A branch and not a flat list, because the papers a first registration rests
 * on are not the same for every building: how tall it is and what year it is
 * dated by decide them. The profile states which values to read the two figures
 * off and which bands to read them into; the report says which band this
 * package fell in and what that band asks the applicant to bring.
 *
 * The engine never checks these papers and cannot: they are not in the envelope
 * and several of them are issued by offices this system does not reach. Naming
 * them is the whole of what it does with them, which is why the message it
 * produces is stated for the applicant and never counted against the package.
 */
export type SupportingDocumentsDeclaration = {
  readonly key: string;
  readonly description: string;
  // Where the height of the building is printed, as [document type key, field
  // key], in the order the papers are believed: the first of these the package
  // states is the one read. The same ordering rule a registry check's subject
  // follows, and for the same reason — one figure is printed on several sheets
  // and they are not equally trustworthy.
  readonly height: readonly (readonly [string, string])[];
  // Where the year the case is dated by is printed, read the same way. A date
  // is read for its year; a bare year is read as itself.
  readonly builtIn: readonly (readonly [string, string])[];
  // In declaration order, and the first band that covers the case wins. Bands
  // need not cover every case: one that no band covers is a hole in the table,
  // and the report says the set could not be decided rather than picking a
  // neighbouring band.
  readonly bands: readonly RequirementBandDeclaration[];
};

// One band of the branch: the heights and the years it answers for, and the
// papers it asks for. Bounds are inclusive at the bottom and exclusive at the
// top, so neighbouring bands can be written as they are spoken — "below 12 m"
// and "12 m and taller" — without an argument about which one owns 12. Null is
// an open end, and a bound left null is a measure this band does not care
// about: a band with no year bounds answers whatever year is read, including
// none at all.
export type RequirementBandDeclaration = {
  readonly key: string;
  readonly description: string;
  // Metres.
  readonly heightFrom: number | null;
  readonly heightBelow: number | null;
  // Years.
  readonly builtFrom: number | null;
  readonly builtBefore: number | null;
  // The papers, named as an applicant would be told them, in English like every
  // other audit line. Free text and not document type keys: none of them is a
  // type this profile classifies, and inventing keys for papers the engine
  // never reads would put words in the contract that answer nothing.
  readonly documents: readonly string[];
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
  // The years this profile answers for, read the same way a requirement band's
  // are — inclusive at the bottom, exclusive at the top, null for an open end.
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

// One band of a supporting-documents branch, as the engine reads it.
export class RequirementBand {
  readonly #documents: readonly string[];

  private constructor(
    public readonly key: string,
    public readonly description: string,
    public readonly heightFrom: number | null,
    public readonly heightBelow: number | null,
    public readonly builtFrom: number | null,
    public readonly builtBefore: number | null,
    documents: readonly string[],
  ) {
    this.#documents = [...documents];
  }

  static of(declaration: RequirementBandDeclaration): RequirementBand {
    return new RequirementBand(
      declaration.key,
      declaration.description,
      declaration.heightFrom,
      declaration.heightBelow,
      declaration.builtFrom,
      declaration.builtBefore,
      declaration.documents,
    );
  }

  get documents(): readonly string[] {
    return this.#documents;
  }

  /*
   * Whether this band answers for a building of this height, dated this year.
   *
   * A measure that could not be read is null, and a band that has something to
   * say about that measure does not cover the case: guessing which side of a
   * threshold an unread figure falls on is the one thing this must never do. A
   * band that says nothing about it covers the case anyway — a rule that holds
   * whatever the year is holds when nobody could read the year.
   */
  covers(metres: number | null, year: number | null): boolean {
    return (
      within(metres, this.heightFrom, this.heightBelow) &&
      within(year, this.builtFrom, this.builtBefore)
    );
  }

  // The band's bounds as one line of the audit message, so a reader of the
  // report can see which rule was applied without opening the profile.
  get bounds(): string {
    const height = boundsSaid(
      this.heightFrom,
      this.heightBelow,
      figure => `${figure} m`,
    );
    const built = boundsSaid(
      this.builtFrom,
      this.builtBefore,
      figure => `${figure}`,
    );

    return (
      [height, built && `built ${built}`].filter(Boolean).join(', ') ||
      'any building'
    );
  }

  // The papers this band asks for, as one line of the audit message.
  get cited(): string {
    return this.#documents.join('; ');
  }
}

export class SupportingDocumentsSpec {
  readonly #height: readonly FieldRef[];
  readonly #builtIn: readonly FieldRef[];
  readonly #bands: readonly RequirementBand[];

  private constructor(
    public readonly key: string,
    public readonly description: string,
    height: readonly FieldRef[],
    builtIn: readonly FieldRef[],
    bands: readonly RequirementBand[],
  ) {
    this.#height = [...height];
    this.#builtIn = [...builtIn];
    this.#bands = [...bands];
  }

  static of(
    declaration: SupportingDocumentsDeclaration,
  ): SupportingDocumentsSpec {
    const refs = (
      pairs: readonly (readonly [string, string])[],
    ): readonly FieldRef[] =>
      pairs.map(([type, field]) =>
        FieldRef.of(DocumentType.create(type), FieldKey.create(field)),
      );

    return new SupportingDocumentsSpec(
      declaration.key,
      declaration.description,
      refs(declaration.height),
      refs(declaration.builtIn),
      declaration.bands.map(band => RequirementBand.of(band)),
    );
  }

  // In the order the papers are believed. The first the package states is the
  // one the figure is read off.
  get height(): readonly FieldRef[] {
    return this.#height;
  }

  get builtIn(): readonly FieldRef[] {
    return this.#builtIn;
  }

  get bands(): readonly RequirementBand[] {
    return this.#bands;
  }

  /*
   * Which band this case falls in, or null where the table gives no answer —
   * because a figure could not be read, or because the bands leave a hole the
   * case fell into. Both are the same thing to a reader: the set could not be
   * decided, and they are told so instead of being told the wrong set.
   *
   * The first band that covers wins. Bands are read in the order the profile
   * declares them, so a table whose bands overlap is answered predictably
   * rather than arbitrarily.
   */
  bandFor(metres: number | null, year: number | null): RequirementBand | null {
    return this.#bands.find(band => band.covers(metres, year)) ?? null;
  }
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
  // same reading a requirement band gives an unread figure.
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
    public readonly expectsStamp: boolean,
    public readonly expectsSignature: boolean,
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
      declaration.expectsStamp,
      declaration.expectsSignature,
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
      false,
      false,
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
    );
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
        // Drawn and issued by the cadastre office: the surveyed figures are
        // its own, and it is the office's seal and the surveyor's hand that say
        // so (ADR-0012).
        expectsStamp: true,
        expectsSignature: true,
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
        // An act of an executive authority. An extract of one is issued by
        // the same authority and attested the same way.
        expectsStamp: true,
        expectsSignature: true,
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
        // Neither mark. The duty is paid at a bank counter or a terminal and
        // the slip that comes back is printed, not sealed; requiring a stamp
        // here would report every correctly paid package as faulty (ADR-0012).
        expectsStamp: false,
        expectsSignature: false,
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
        required: true,
        // Produced and approved by a design organisation, which signs and
        // seals the title block of what it puts its name to.
        expectsStamp: true,
        expectsSignature: true,
        fields: [
          ['project_name', 'Project name'],
          ['designer_name', 'Design organisation'],
          ['property_address', 'Property address'],
          ['total_area', 'Total area'],
          ['storeys', 'Storeys'],
          // Read for its own sake and for the branch: which supporting
          // documents this case needs is decided on how tall the building is,
          // and the sketch design is the only paper of this profile that says.
          ['building_height', 'Building height'],
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
        // What an archive issues over its own seal. Unsealed it states
        // nothing: the whole worth of the certificate is which office says it.
        expectsStamp: true,
        expectsSignature: true,
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
        // Signed and not sealed: it is written by a natural person, who has no
        // seal to press. The signature is what makes it their application.
        expectsStamp: false,
        expectsSignature: true,
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
        // Neither. Its security features are printed into the card and the
        // reader marks them [photo], not [stamp]; a passport's specimen
        // signature is on a page the package need not carry (ADR-0012).
        expectsStamp: false,
        expectsSignature: false,
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
        ],
      },
    ],
    // What the applicant is told to bring beyond the envelope, which depends on
    // the building rather than on the papers. Held in a file of its own and
    // marked provisional there: the thresholds and the sets in it are ours and
    // not the customer's, and the mechanism that reads them is the part of this
    // that is real.
    [UNCONFIRMED_SUPPORTING_DOCUMENTS],
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
    // What this profile answers for at the counter.
    //
    // One ground: the order of the executive authority that allotted the parcel
    // is the only paper in this profile that grants anything. The plan-scheme
    // depicts, the archival certificate attests, the receipt records a payment
    // and the application asks — none of them founds a right, and offering one
    // of them as a ground would put a choice on the intake screen that means
    // nothing. A case founded on a sale, an inheritance or a court decision is
    // a case this build has no profile for, and the suggestion says so rather
    // than proposing this one.
    //
    // No year bounds: this profile takes a case of any year. The supporting
    // documents a case needs turn on the year (ADR-0013), but which profile
    // governs it does not — no norm has been given that says otherwise, and a
    // threshold invented here would be a threshold that silently sent
    // submissions to the wrong policy.
    {
      grounds: ['disposal_order'],
      builtFrom: null,
      builtBefore: null,
    },
  );

  readonly #specs: readonly DocumentTypeSpec[];
  readonly #crossChecks: readonly CrossCheckSpec[];
  readonly #registryChecks: readonly RegistryCheckSpec[];
  readonly #supportingDocuments: readonly SupportingDocumentsSpec[];
  readonly #particulars: ParticularsSpec;
  readonly #intake: IntakeSpec;

  private constructor(
    public readonly key: string,
    declarations: readonly Declaration[],
    crossChecks: readonly CrossCheckDeclaration[],
    registryChecks: readonly RegistryCheckDeclaration[] = [],
    supportingDocuments: readonly SupportingDocumentsDeclaration[] = [],
    particulars: ParticularsDeclaration | null = null,
    intake: IntakeDeclaration | null = null,
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
    this.#supportingDocuments = supportingDocuments.map(declaration =>
      SupportingDocumentsSpec.of(declaration),
    );
    this.#particulars = particulars
      ? ParticularsSpec.of(particulars)
      : ParticularsSpec.none();
    this.#intake = intake ? IntakeSpec.of(intake) : IntakeSpec.none();

    VerificationProfile.guardGroundsAreDeclared(key, this.#specs, this.#intake);
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
   * The branches this profile declares: what the applicant has to bring beyond
   * the envelope, and which of the sets this case needs.
   *
   * Empty on a profile that asks for nothing beyond its own document types, and
   * empty is not a gap — most policies have one set and say it in the required
   * types.
   */
  get supportingDocuments(): readonly SupportingDocumentsSpec[] {
    return this.#supportingDocuments;
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
