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
  static readonly CADASTRE = new VerificationProfile("cadastre", [
    {
      key: "registration_application",
      description:
        "Application for state registration of rights to immovable property, " +
        "submitted by the applicant to the registration authority. Names the " +
        "applicant and the property the rights concern.",
      hints: [
        "hüquqların dövlət qeydiyyatı haqqında ərizə",
        "dövlət qeydiyyatı haqqında ərizə",
        "заявление о государственной регистрации",
        "государственной регистрации прав на недвижимое имущество",
      ],
      required: true,
      fields: [
        ["applicant_name", "Applicant name"],
        ["applicant_document_no", "Applicant identity document number"],
        ["property_address", "Property address"],
        ["cadastral_number", "Cadastral number"],
        ["registry_office", "Registration authority"],
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
    {
      key: "notification_application",
      description:
        "Application filed under the notification procedure — the route for " +
        "construction work that needs notice given rather than a permit " +
        "issued. Distinguished from the registration application by naming " +
        "that procedure explicitly.",
      hints: [
        "bildiriş icraatı qaydasında ərizə",
        "bildiriş icraatı",
        "в порядке уведомительного производства",
        "уведомительного производства",
      ],
      required: true,
      fields: [
        ["applicant_name", "Applicant name"],
        ["property_address", "Property address"],
        ["cadastral_number", "Cadastral number"],
        ["construction_purpose", "Purpose of the works"],
        ["application_date", "Application date"],
      ],
    },
    {
      key: "architectural_plan",
      description:
        "Architectural and planning decision — the outline or sketch design " +
        "of the building, produced by a design organisation. Carries drawings, " +
        "the designer's name and the areas and storeys of what is proposed.",
      hints: [
        "memarlıq-planlaşdırma",
        "eskiz layihə",
        "архитектурно-планировочное",
        "эскизный проект",
      ],
      required: true,
      fields: [
        ["project_name", "Project name"],
        ["designer_name", "Design organisation"],
        ["property_address", "Property address"],
        ["cadastral_number", "Cadastral number"],
        ["total_area", "Total area"],
        ["approval_date", "Approval date"],
      ],
    },
    {
      key: "license",
      description:
        "The licence itself: the certificate authorising its holder to carry " +
        "out a regulated activity such as design or construction. It states " +
        "the holder, the activity and the issuing authority — it does not " +
        "list individual works.",
      hints: ["lisenziya", "лицензия", "licence", "license"],
      required: true,
      fields: [
        ["license_no", "Licence number"],
        ["licensee_name", "Licence holder"],
        ["activity_type", "Licensed activity"],
        ["issuing_authority", "Issuing authority"],
        ["issue_date", "Issue date"],
        ["expiry_date", "Expiration date"],
      ],
    },
    {
      key: "license_annex",
      description:
        "Annex to a licence: the sheet that lists the specific works or scope " +
        "a licence covers, and refers to that licence by its number. It is not " +
        "the licence itself — if the sheet grants the authorisation it is a " +
        "license; if it enumerates what an already-granted licence covers it " +
        "is this.",
      hints: [
        "lisenziyaya əlavə",
        "приложение к лицензии",
        "приложение к лицензи",
      ],
      required: true,
      fields: [
        ["license_no", "Licence number"],
        ["annex_no", "Annex number"],
        ["licensee_name", "Licence holder"],
        ["activity_type", "Works covered"],
        ["issue_date", "Issue date"],
      ],
    },
  ]);

  static readonly DEMO = new VerificationProfile("demo", [
    {
      key: "passport",
      description: "Passport or identity card of a natural person.",
      hints: ["passport", "паспорт", "şəxsiyyət vəsiqəsi"],
      required: true,
      fields: [
        ["first_name", "First name"],
        ["last_name", "Last name"],
        ["dob", "Date of birth"],
        ["passport_no", "Passport number"],
        ["expiry_date", "Expiration date"],
      ],
    },
    {
      key: "driver_license",
      description: "Driving licence of a natural person.",
      hints: ["driver license", "driver licence", "driving licence"],
      required: true,
      fields: [
        ["first_name", "First name"],
        ["last_name", "Last name"],
        ["license_no", "Licence number"],
        ["expiry_date", "Expiration date"],
      ],
    },
    {
      key: "application",
      description: "Application form naming an applicant and their documents.",
      hints: ["application form", "application"],
      required: true,
      fields: [
        ["applicant_name", "Applicant name"],
        ["passport_no", "Passport number"],
        ["driver_license_no", "Driver licence number"],
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
    return [VerificationProfile.CADASTRE, VerificationProfile.DEMO];
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
