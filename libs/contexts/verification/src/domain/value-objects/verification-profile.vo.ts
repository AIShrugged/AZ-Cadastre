import { UnknownProfileException } from "../exceptions/index.js";
import { DocumentType } from "./document-type.vo.js";
import { FieldSchema, FieldSpec } from "./field-schema.vo.js";

export class VerificationProfile {
  static readonly DEMO = new VerificationProfile("demo", [
    [
      "passport",
      [
        ["first_name", "First name"],
        ["last_name", "Last name"],
        ["dob", "Date of birth"],
        ["passport_no", "Passport number"],
        ["expiry", "Expiration date"],
      ],
    ],
    [
      "driver_license",
      [
        ["first_name", "First name"],
        ["last_name", "Last name"],
        ["license_no", "License number"],
        ["expiry", "Expiration date"],
      ],
    ],
    [
      "application",
      [
        ["applicant_name", "Applicant name"],
        ["passport_no", "Passport number"],
        ["driver_license_no", "Driver license number"],
      ],
    ],
  ]);

  static readonly CADASTRE = new VerificationProfile("cadastre", [
    [
      "passport",
      [
        ["first_name", "First name"],
        ["last_name", "Last name"],
        ["dob", "Date of birth"],
        ["passport_no", "Passport number"],
        ["expiry", "Expiration date"],
      ],
    ],
    [
      "application",
      [
        ["applicant_name", "Applicant name"],
        ["passport_no", "Passport number"],
        ["driver_license_no", "Driver license number"],
      ],
    ],
    [
      "title_deed",
      [
        ["owner_name", "Owner name"],
        ["parcel_id", "Parcel ID"],
        ["issue_date", "Issue date"],
      ],
    ],
    [
      "cadastral_extract",
      [
        ["parcel_id", "Parcel ID"],
        ["area", "Area"],
        ["registry_date", "Registry date"],
      ],
    ],
  ]);

  readonly #schemas: ReadonlyMap<string, FieldSchema>;

  private constructor(
    public readonly key: string,
    declarations: readonly (readonly [
      string,
      readonly (readonly [string, string])[],
    ])[],
  ) {
    this.#schemas = new Map(
      declarations.map(([type, fields]) => [
        type,
        FieldSchema.of(fields.map(([key, label]) => FieldSpec.of(key, label))),
      ]),
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

  get documentTypes(): readonly DocumentType[] {
    return [...this.#schemas.keys()].map((type) => DocumentType.create(type));
  }

  recognises(type: DocumentType): boolean {
    return this.#schemas.has(type.value);
  }

  schemaFor(type: DocumentType): FieldSchema {
    return this.#schemas.get(type.value) ?? FieldSchema.none();
  }

  equals(other: VerificationProfile): boolean {
    return this.key === other.key;
  }
}
