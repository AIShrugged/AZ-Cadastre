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
  document_no: "AZE1234567",
  issue_date: "12.02.2021",
  expiry_date: "21.09.2030",

  applicant_name: "ELÇİN ƏLİYEV",
  applicant_document_no: "AZE1234567",
  owner_name: "ELÇİN ƏLİYEV",
  property_address: "Bakı ş., Nəsimi r., Azadlıq pr. 12, mən. 43",
  cadastral_number: "AZ-CAD-1024-311",
  application_date: "03.11.2025",

  plot_area: "642 m²",
  plan_date: "27.09.2025",

  order_no: "R-1147",
  issuing_authority: "Bakı Şəhər İcra Hakimiyyəti",

  receipt_no: "QB-2025-88301",
  payer_name: "ELÇİN ƏLİYEV",
  amount: "60,00 AZN",
  payment_date: "05.11.2025",
  payment_purpose: "Dövlət qeydiyyatı üçün dövlət rüsumu",

  project_name: "Fərdi yaşayış evi — eskiz layihə",
  designer_name: '"AzMemarLayihə" MMC',
  total_area: "248 m²",
  storeys: "2",
  approval_date: "18.12.2025",

  certificate_no: "ARX-2025-0417",

  area: "642 m²",
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
