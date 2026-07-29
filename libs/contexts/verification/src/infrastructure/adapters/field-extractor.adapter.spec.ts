import { describe, expect, it } from "vitest";

import {
  DocumentType,
  FieldSchema,
  FieldSpec,
  RecognisedText,
  VerificationProfile,
} from "../../domain/value-objects/index.js";
import { FieldExtractorAdapter } from "./field-extractor.adapter.js";

const PASSPORT = DocumentType.create("passport");

const PASSPORT_TEXT = [
  "REPUBLIC OF AZERBAIJAN",
  "PASSPORT",
  "Surname / Soyad: ALIYEV",
  "Given names / Ad: ELCHIN",
  "Passport No: AZE1234567",
].join("\n");

function extract(
  schema: FieldSchema,
  documentType: DocumentType = PASSPORT,
  text: string = PASSPORT_TEXT,
) {
  return new FieldExtractorAdapter().extract({
    text: RecognisedText.of(text),
    documentType,
    schema,
  });
}

describe("FieldExtractorAdapter", () => {
  it("answers with a value for every field the type declares", async () => {
    const schema = VerificationProfile.CADASTRE.schemaFor(PASSPORT);

    const fields = await extract(schema);

    expect(fields.map((field) => field.key.value)).toEqual([
      "first_name",
      "last_name",
      "dob",
      "passport_no",
      "expiry",
    ]);
  });

  it("answers with the demo persona's own values, so a re-run reports the same numbers", async () => {
    const fields = await extract(VerificationProfile.CADASTRE.schemaFor(PASSPORT));

    expect(
      Object.fromEntries(
        fields.map((field) => [field.key.value, field.value.value]),
      ),
    ).toEqual({
      first_name: "ELCHIN",
      last_name: "ALIYEV",
      dob: "14.03.1988",
      passport_no: "AZE1234567",
      expiry: "21.09.2030",
    });
  });

  it("gives the same answer twice, because the mock has nothing random in it", async () => {
    const schema = VerificationProfile.CADASTRE.schemaFor(PASSPORT);

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
    const schema = VerificationProfile.DEMO.schemaFor(DocumentType.create("title_deed"));

    expect(await extract(schema, DocumentType.create("title_deed"))).toEqual([]);
  });

  it("never answers with a key the schema did not declare", async () => {
    const schema = FieldSchema.of([FieldSpec.of("parcel_id", "Parcel ID")]);

    const fields = await extract(schema, DocumentType.create("cadastral_extract"));

    for (const field of fields) {
      expect(schema.declares(field.key)).toBe(true);
    }
  });

  it("keeps the fields in the order the schema declared them", async () => {
    const schema = FieldSchema.of([
      FieldSpec.of("expiry", "Expiration date"),
      FieldSpec.of("first_name", "First name"),
      FieldSpec.of("dob", "Date of birth"),
    ]);

    const fields = await extract(schema);

    expect(fields.map((field) => field.key.value)).toEqual([
      "expiry",
      "first_name",
      "dob",
    ]);
  });

  it("reports the same fixed confidence for every value, and reads them all off the first page", async () => {
    const fields = await extract(VerificationProfile.CADASTRE.schemaFor(PASSPORT));

    expect(fields.map((field) => field.confidence.value)).toEqual([
      0.92, 0.92, 0.92, 0.92, 0.92,
    ]);
    expect(fields.every((field) => field.foundOn.value === 1)).toBe(true);
  });
});
