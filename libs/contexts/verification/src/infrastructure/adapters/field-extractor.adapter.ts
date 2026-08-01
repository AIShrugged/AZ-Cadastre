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
  first_name: "ELÇİN",
  last_name: "ƏLİYEV",
  dob: "14.03.1988",
  document_no: "AZE1234567",
  passport_no: "AZE1234567",
  issue_date: "12.02.2021",
  expiry_date: "21.09.2030",

  applicant_name: "ELÇİN ƏLİYEV",
  applicant_document_no: "AZE1234567",
  property_address: "Bakı ş., Nəsimi r., Azadlıq pr. 12, mən. 43",
  cadastral_number: "AZ-CAD-1024-311",
  registry_office: "Əmlak Məsələləri Dövlət Xidməti",
  application_date: "03.11.2025",
  construction_purpose: "Fərdi yaşayış evinin tikintisi",

  project_name: "Fərdi yaşayış evi — eskiz layihə",
  designer_name: '"AzMemarLayihə" MMC',
  total_area: "642 m²",
  approval_date: "18.12.2025",

  license_no: "AZ-LIC-2019-4471",
  licensee_name: '"AzMemarLayihə" MMC',
  activity_type: "Tikinti layihələndirilməsi",
  issuing_authority: "Dövlət Şəhərsalma və Arxitektura Komitəsi",
  annex_no: "1",

  driver_license_no: "AZ87654321",
  owner_name: "ELÇİN ƏLİYEV",
  parcel_id: "AZ-CAD-1024-311",
  area: "642 m²",
  registry_date: "03.11.2020",
};

const MOCK_CONFIDENCE = 0.92;

@Injectable()
export class FieldExtractorAdapter extends FieldExtractor {
  async extract(
    request: ExtractionRequest,
  ): Promise<readonly ExtractedField[]> {
    return request.spec.schema.specs.flatMap((spec) => {
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
