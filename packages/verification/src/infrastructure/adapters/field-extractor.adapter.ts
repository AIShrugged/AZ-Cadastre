import { Injectable } from '@nestjs/common';

import {
  FieldExtractor,
  type ExtractionRequest,
} from '../../application/ports/outbound/index.js';
import { ExtractedField } from '../../domain/entities/index.js';
import {
  Confidence,
  FieldValue,
  PageNumber,
} from '../../domain/value-objects/index.js';

const MOCK_VALUES: Record<string, string> = {
  first_name: 'ELÇİN',
  last_name: 'ƏLİYEV',
  document_no: 'AZE1234567',
  issue_date: '12.02.2021',
  expiry_date: '21.09.2030',

  applicant_name: 'ELÇİN ƏLİYEV',
  applicant_document_no: 'AZE1234567',
  owner_name: 'ELÇİN ƏLİYEV',
  property_address: 'Bakı ş., Nəsimi r., Azadlıq pr. 12, mən. 43',
  cadastral_number: 'AZ-CAD-1024-311',
  application_date: '03.11.2025',

  plot_area: '642 m²',
  actual_area: '642 m²',
  plan_date: '27.09.2025',
  plan_scale: '1:500',
  land_category: 'Fərdi yaşayış tikintisi üçün torpaq',
  ownership_type: 'Xüsusi mülkiyyət',
  right_type: 'Mülkiyyət hüququ',
  registry_no: 'RN-2025-004312',
  easements: 'Yoxdur',
  turning_points:
    'N1 (X 4470210,15; Y 8512340,20) — 24,60 m; ' +
    'N2 (X 4470234,10; Y 8512346,05) — 26,10 m; ' +
    'N3 (X 4470228,40; Y 8512371,50) — 24,60 m; ' +
    'N4 (X 4470204,55; Y 8512365,75) — 26,10 m',
  plan_basis:
    'Bakı Şəhər İcra Hakimiyyətinin 12.09.2025 tarixli R-1147 saylı sərəncamı',
  qr_code: 'https://e-emdk.gov.az/plan/RN-2025-004312',

  order_no: 'R-1147',
  issuing_authority: 'Bakı Şəhər İcra Hakimiyyəti',

  receipt_no: 'QB-2025-88301',
  payer_name: 'ELÇİN ƏLİYEV',
  amount: '60,00 AZN',
  payment_date: '05.11.2025',
  payment_purpose: 'Dövlət qeydiyyatı üçün dövlət rüsumu',

  project_name: 'Fərdi yaşayış evi — eskiz layihə',
  designer_name: '"AzMemarLayihə" MMC',
  designer_tax_id: '1400512345',
  designer_director: 'RƏŞAD MƏMMƏDOV',
  chief_architect: 'NİGAR HÜSEYNOVA',
  client_name: 'ELÇİN ƏLİYEV',
  drawing_schedule:
    'AR-01 situasiya planı; AR-02 baş plan; AR-03…AR-04 mərtəbə planları; ' +
    'AR-05 dam planı; AR-06 kəsik; AR-07…AR-09 fasadlar',
  sheet_count: '9',
  project_composition:
    'Situasiya planı; baş plan; mərtəbə planları; dam planı; kəsik; fasadlar',
  built_up_area: '138 m²',
  total_area: '248 m²',
  building_volume: '744 m³',
  storeys: '2',
  datum_level: '±0.000 — birinci mərtəbənin döşəmə səviyyəsi (mütləq 12,40 m)',
  building_height: '9,4 m',
  span_dimensions: 'A—B 6,00 m; B—C 5,40 m; 1—2 4,80 m; 2—3 4,80 m',
  project_scale: '1:100',
  approval_date: '18.12.2025',

  certificate_no: 'ARX-2025-0417',

  area: '642 m²',
};

const MOCK_CONFIDENCE = 0.92;

@Injectable()
export class FieldExtractorAdapter extends FieldExtractor {
  async extract(
    request: ExtractionRequest,
  ): Promise<readonly ExtractedField[]> {
    return request.spec.schema.specs.flatMap(spec => {
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
