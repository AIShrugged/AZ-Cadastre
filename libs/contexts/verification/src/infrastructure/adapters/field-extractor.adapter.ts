import { Injectable } from "@nestjs/common";

import {
  FieldExtractor,
  type ExtractionRequest,
} from "../../application/ports/index.js";
import { ExtractedField } from "../../domain/entities/index.js";
import {
  Confidence,
  FieldValue,
  PageNumber,
} from "../../domain/value-objects/index.js";

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

const MOCK_CONFIDENCE = 0.92;

@Injectable()
export class FieldExtractorAdapter extends FieldExtractor {
  async extract(
    request: ExtractionRequest,
  ): Promise<readonly ExtractedField[]> {
    return request.schema.specs.flatMap((spec) => {
      const value = MOCK_VALUES[spec.key.value];

      return value
        ? [
            ExtractedField.of(
              spec.key,
              FieldValue.create(value),
              Confidence.of(MOCK_CONFIDENCE),
              PageNumber.first(),
            ),
          ]
        : [];
    });
  }
}
