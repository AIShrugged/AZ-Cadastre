import { describe, expect, it } from "vitest";

import {
  DocumentType,
  type DocumentTypeSpec,
  FieldSchema,
  FieldSpec,
  RecognisedText,
  VerificationProfile,
} from "../../domain/value-objects/index.js";
import { FieldExtractorAdapter } from "./field-extractor.adapter.js";

const IDENTITY_CARD = DocumentType.create("identity_card");

const IDENTITY_TEXT = [
  "AZƏRBAYCAN RESPUBLİKASI",
  "ŞƏXSİYYƏT VƏSİQƏSİ",
  "Soyadı: ƏLİYEV",
  "Adı: ELÇİN",
  "Vəsiqə No: AZE1234567",
].join("\n");

// The adapter reads its answers off the schema, so a test can hand it any
// schema under a real type without the profile having to declare that pairing.
function specOf(type: DocumentType, schema: FieldSchema): DocumentTypeSpec {
  return { ...VerificationProfile.CADASTRE.specFor(type), schema };
}

function extract(
  schema: FieldSchema,
  type: DocumentType = IDENTITY_CARD,
  text: string = IDENTITY_TEXT,
) {
  return new FieldExtractorAdapter().extract({
    text: RecognisedText.of(text),
    spec: specOf(type, schema),
  });
}

describe("FieldExtractorAdapter", () => {
  it("answers with a value for every field the type declares", async () => {
    const schema = VerificationProfile.CADASTRE.schemaFor(IDENTITY_CARD);

    const fields = await extract(schema);

    expect(fields.map((field) => field.key.value)).toEqual([
      "first_name",
      "last_name",
      "document_no",
      "issue_date",
      "expiry_date",
    ]);
  });

  it("answers with the demo persona's own values, so a re-run reports the same numbers", async () => {
    const fields = await extract(
      VerificationProfile.CADASTRE.schemaFor(IDENTITY_CARD),
    );

    expect(
      Object.fromEntries(
        fields.map((field) => [field.key.value, field.value.value]),
      ),
    ).toEqual({
      first_name: "ELÇİN",
      last_name: "ƏLİYEV",
      document_no: "AZE1234567",
      issue_date: "12.02.2021",
      expiry_date: "21.09.2030",
    });
  });

  it("answers for every required type of the cadastre profile, so a mocked run is never empty", async () => {
    for (const spec of VerificationProfile.CADASTRE.specs) {
      const fields = await extract(spec.schema, spec.type);

      expect(fields.length).toBe(spec.schema.specs.length);
    }
  });

  it("gives the same answer twice, because the mock has nothing random in it", async () => {
    const schema = VerificationProfile.CADASTRE.schemaFor(IDENTITY_CARD);

    const first = await extract(schema);
    const second = await extract(schema);

    expect(first.map((field) => field.value.value)).toEqual(
      second.map((field) => field.value.value),
    );
  });

  it("skips a field it has no value for rather than answering with an empty one", async () => {
    const schema = FieldSchema.of([
      FieldSpec.of("first_name", "First name"),
      FieldSpec.of("mothers_maiden_name", "Mother's maiden name"),
      FieldSpec.of("last_name", "Last name"),
    ]);

    const fields = await extract(schema);

    expect(fields.map((field) => field.key.value)).toEqual([
      "first_name",
      "last_name",
    ]);
  });

  it("answers with nothing at all when it recognises none of the declared fields", async () => {
    const schema = FieldSchema.of([
      FieldSpec.of("mothers_maiden_name", "Mother's maiden name"),
      FieldSpec.of("blood_type", "Blood type"),
    ]);

    expect(await extract(schema)).toEqual([]);
  });

  it("answers with nothing at all for a type that declares no fields", async () => {
    expect(await extract(FieldSchema.none())).toEqual([]);
  });

  it("answers with nothing for a type no profile recognises, because it declares no fields", async () => {
    const stray = DocumentType.create("invoice");

    expect(
      await extract(VerificationProfile.CADASTRE.schemaFor(stray), stray),
    ).toEqual([]);
  });

  it("never answers with a key the schema did not declare", async () => {
    const schema = FieldSchema.of([
      FieldSpec.of("cadastral_number", "Cadastral number"),
    ]);

    const fields = await extract(
      schema,
      DocumentType.create("registration_application"),
    );

    for (const field of fields) {
      expect(schema.declares(field.key)).toBe(true);
    }
  });

  it("keeps the fields in the order the schema declared them", async () => {
    const schema = FieldSchema.of([
      FieldSpec.of("expiry_date", "Expiration date"),
      FieldSpec.of("first_name", "First name"),
      FieldSpec.of("document_no", "Document number"),
    ]);

    const fields = await extract(schema);

    expect(fields.map((field) => field.key.value)).toEqual([
      "expiry_date",
      "first_name",
      "document_no",
    ]);
  });

  it("reports the same fixed confidence for every value, and reads them all off the first page", async () => {
    const fields = await extract(
      VerificationProfile.CADASTRE.schemaFor(IDENTITY_CARD),
    );

    expect(fields.map((field) => field.confidence.value)).toEqual([
      0.92, 0.92, 0.92, 0.92, 0.92,
    ]);
    expect(fields.every((field) => field.foundOn.value === 1)).toBe(true);
  });
});
