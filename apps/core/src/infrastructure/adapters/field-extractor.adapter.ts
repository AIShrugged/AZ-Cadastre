import { Injectable } from "@nestjs/common";

import {
  FieldExtractor,
  type ExtractInput,
  type ExtractedFieldValue,
} from "../../application/ports/field-extractor.port.js";

/** Deterministic demo values, keyed by field — matches the mock OCR persona. */
const MOCK_VALUES: Record<string, string> = {
  first_name: "ELCHIN",
  last_name: "ALIYEV",
  dob: "14.03.1988",
  passport_no: "AZE1234567",
  expiry: "21.09.2030",
  license_no: "AZ87654321",
  applicant_name: "ELCHIN ALIYEV",
  driver_license_no: "AZ87654321",
  owner_name: "ELCHIN ALIYEV",
  parcel_id: "AZ-CAD-1024-311",
  area: "642 m²",
  issue_date: "12.02.2021",
  registry_date: "03.11.2020",
};

/**
 * Mock field extractor (ADR-0003). Returns fixed demo values for the requested
 * schema fields, so the pipeline produces a coherent result without a real model.
 */
@Injectable()
export class FieldExtractorAdapter extends FieldExtractor {
  async extract(input: ExtractInput): Promise<ExtractedFieldValue[]> {
    return input.fields.flatMap((spec) => {
      const value = MOCK_VALUES[spec.key];
      return value
        ? [{ name: spec.key, value, confidence: 0.92, pageNumber: 1 }]
        : [];
    });
  }
}
