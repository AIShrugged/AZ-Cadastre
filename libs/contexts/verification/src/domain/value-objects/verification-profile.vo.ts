import { UnknownProfileException } from "../exceptions/index.js";
import { DocumentType } from "./document-type.vo.js";
import { FieldSchema, FieldSpec } from "./field-schema.vo.js";

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
    return new DocumentTypeSpec(type, "", [], FieldSchema.none(), false);
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
  static readonly CADASTRE = new VerificationProfile("cadastre", [
    {
      key: "land_plot_plan",
      description:
        "Plan-scheme of the land parcel: the surveyed drawing of the plot " +
        "with its boundaries, area and cadastral number. It depicts the land " +
        "itself, not the building proposed on it.",
      hints: [
        "torpaq sahəsinin plan-sxemi",
        "plan-sxem",
        "план-схема земельного участка",
        "план-схема",
      ],
      required: true,
      fields: [
        ["property_address", "Property address"],
        ["cadastral_number", "Cadastral number"],
        ["plot_area", "Plot area"],
        ["owner_name", "Owner name"],
        ["plan_date", "Plan date"],
      ],
    },
    {
      key: "disposal_order",
      description:
        "Order of the executive authority allotting the land parcel, or an " +
        "extract from that order. It is issued by an authority and carries an " +
        "order number and date — an extract states the same order in short.",
      hints: [
        "sərəncamdan çıxarış",
        "sərəncam",
        "выписка из распоряжения",
        "распоряжение",
      ],
      required: true,
      fields: [
        ["order_no", "Order number"],
        ["issuing_authority", "Issuing authority"],
        ["issue_date", "Issue date"],
        ["applicant_name", "Applicant name"],
        ["property_address", "Property address"],
        ["plot_area", "Plot area"],
      ],
    },
    {
      key: "payment_receipt",
      description:
        "Receipt for the state duty paid for the registration. Carries a " +
        "receipt number, the payer, an amount and the date it was paid.",
      hints: [
        "ödəniş qəbzi",
        "qəbz",
        "квитанция об оплате",
        "квитанция",
      ],
      required: true,
      fields: [
        ["receipt_no", "Receipt number"],
        ["payer_name", "Payer name"],
        ["amount", "Amount paid"],
        ["payment_date", "Payment date"],
        ["payment_purpose", "Payment purpose"],
      ],
    },
    {
      key: "sketch_project",
      description:
        "Sketch design of the house, produced by a design organisation. " +
        "Carries drawings, the designer's name and the areas and storeys of " +
        "what is proposed — the building, not the plot it stands on.",
      hints: [
        "eskiz layihəsi",
        "eskiz layihə",
        "эскизный проект",
        "эскизного проекта",
      ],
      required: true,
      fields: [
        ["project_name", "Project name"],
        ["designer_name", "Design organisation"],
        ["property_address", "Property address"],
        ["total_area", "Total area"],
        ["storeys", "Storeys"],
        ["approval_date", "Approval date"],
      ],
    },
    {
      key: "archive_certificate",
      description:
        "Archival certificate: the statement an archive issues about the " +
        "history of the plot or the building — what is on record about it, " +
        "under a certificate number and a date of issue.",
      hints: [
        "arxiv arayışı",
        "arxiv arayış",
        "архивная справка",
        "архивной справки",
      ],
      required: true,
      fields: [
        ["certificate_no", "Certificate number"],
        ["issuing_authority", "Issuing authority"],
        ["issue_date", "Issue date"],
        ["property_address", "Property address"],
        ["owner_name", "Owner name"],
      ],
    },
    {
      key: "application",
      description:
        "The applicant's own application for state registration, addressed " +
        "to the registration authority. Names the applicant, their identity " +
        "document and the property the registration concerns.",
      hints: [
        "dövlət qeydiyyatı haqqında ərizə",
        "ərizə",
        "заявление о государственной регистрации",
        "заявление",
      ],
      required: true,
      fields: [
        ["applicant_name", "Applicant name"],
        ["applicant_document_no", "Applicant identity document number"],
        ["property_address", "Property address"],
        ["cadastral_number", "Cadastral number"],
        ["application_date", "Application date"],
      ],
    },
    {
      key: "identity_card",
      description:
        "State-issued identity document of a natural person — an identity " +
        "card or a passport. Carries a photograph, a surname and given name, " +
        "a document number and validity dates.",
      hints: [
        "şəxsiyyət vəsiqəsi",
        "удостоверение личности",
        "identity card",
        "паспорт",
        "passport",
      ],
      required: true,
      fields: [
        ["first_name", "First name"],
        ["last_name", "Last name"],
        ["document_no", "Document number"],
        ["issue_date", "Issue date"],
        ["expiry_date", "Expiration date"],
      ],
    },
  ]);

  readonly #specs: readonly DocumentTypeSpec[];

  private constructor(
    public readonly key: string,
    declarations: readonly Declaration[],
  ) {
    this.#specs = declarations.map((declaration) =>
      DocumentTypeSpec.of(declaration),
    );
  }

  // The order a caller is offered them in, and a getter so it cannot be read
  // before the static instances exist.
  static get all(): readonly VerificationProfile[] {
    return [VerificationProfile.CADASTRE];
  }

  static of(rawKey: string): VerificationProfile {
    const found = VerificationProfile.all.find(
      (candidate) => candidate.key === rawKey,
    );

    if (!found) throw new UnknownProfileException(rawKey);

    return found;
  }

  get specs(): readonly DocumentTypeSpec[] {
    return this.#specs;
  }

  get documentTypes(): readonly DocumentType[] {
    return this.#specs.map((spec) => spec.type);
  }

  get requiredTypes(): readonly DocumentType[] {
    return this.#specs
      .filter((spec) => spec.isRequired)
      .map((spec) => spec.type);
  }

  recognises(type: DocumentType): boolean {
    return this.#specs.some((spec) => spec.type.equals(type));
  }

  specFor(type: DocumentType): DocumentTypeSpec {
    return (
      this.#specs.find((spec) => spec.type.equals(type)) ??
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
