/**
 * Field schemas per document type (PRD §4.5). Part of the Verification Profile
 * policy, in code (ADR-0002). Each type declares the fields the extractor pulls;
 * keys match the web app's i18n `field.*` labels. Extended as new document types
 * are added — the extractor is generic over whatever schema it's handed.
 */

export type FieldSpec = {
  /** Stable key, stored on the extracted field and used for i18n labels. */
  key: string;
  /** Human label — fed to the LLM extractor as the field description. */
  label: string;
};

export const FIELD_SCHEMAS: Record<string, FieldSpec[]> = {
  passport: [
    { key: "first_name", label: "First name" },
    { key: "last_name", label: "Last name" },
    { key: "dob", label: "Date of birth" },
    { key: "passport_no", label: "Passport number" },
    { key: "expiry", label: "Expiration date" },
  ],
  driver_license: [
    { key: "first_name", label: "First name" },
    { key: "last_name", label: "Last name" },
    { key: "license_no", label: "License number" },
    { key: "expiry", label: "Expiration date" },
  ],
  application: [
    { key: "applicant_name", label: "Applicant name" },
    { key: "passport_no", label: "Passport number" },
    { key: "driver_license_no", label: "Driver license number" },
  ],
  title_deed: [
    { key: "owner_name", label: "Owner name" },
    { key: "parcel_id", label: "Parcel ID" },
    { key: "issue_date", label: "Issue date" },
  ],
  cadastral_extract: [
    { key: "parcel_id", label: "Parcel ID" },
    { key: "area", label: "Area" },
    { key: "registry_date", label: "Registry date" },
  ],
};

/** Field schema for a document type (empty if the type has none / is unknown). */
export function fieldSchema(type: string): FieldSpec[] {
  return FIELD_SCHEMAS[type] ?? [];
}
