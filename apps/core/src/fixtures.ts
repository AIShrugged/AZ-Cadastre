import { Case } from "@cadastre/contracts";
import type {
  Case as TCase,
  CaseDocument,
  DocumentType,
  ExtractedField,
} from "@cadastre/contracts";

/**
 * Synthetic demo data (ADR-0002 §8): one clean case (Əliyeva, OK) and one with
 * planted defects (Rusadze) to show Completeness (A) and Consistency (C) on
 * contrast. No real documents or LLM calls — this is fixture data.
 */

/** Обязательные Типы документов для услуги «первичная регистрация» (проверка A). */
export const REQUIRED_TYPES: readonly DocumentType[] = [
  "erize",
  "sexsiyyet_vesiqesi",
  "serencam",
  "plan_sxem",
  "texniki_pasport",
  "qebz",
];

export const DOCUMENT_TITLES: Record<DocumentType, string> = {
  erize: "Ərizə",
  sexsiyyet_vesiqesi: "Şəxsiyyət vəsiqəsi",
  serencam: "Sərəncam",
  emrden_cixaris: "Əmrdən çıxarış",
  arxiv_arayisi: "Arxiv arayışı",
  plan_sxem: "Plan-sxem",
  layihe: "Layihə",
  lisenziya: "Lisenziya",
  melumatlandirma_erizesi: "Məlumatlandırma ərizəsi",
  qebz: "Qəbz",
  qiymetlendirme_muqavilesi: "Qiymətləndirmə müqaviləsi",
  texniki_pasport: "Texniki pasport",
  muayine_akti: "Müayinə aktı",
  unknown: "Naməlum",
};

function field(
  docId: string,
  page: number,
  key: string,
  label: string,
  value: string,
  confidence: number,
): ExtractedField {
  return {
    id: `${docId}-f-${key}`,
    key,
    label,
    value,
    documentId: docId,
    pageNumber: page,
    confidence,
  };
}

function doc(
  caseId: string,
  type: DocumentType,
  page: number,
  classificationConfidence: number,
  fields: ExtractedField[],
): CaseDocument {
  return {
    id: `${caseId}-doc-${type}`,
    type,
    title: DOCUMENT_TITLES[type],
    pageNumbers: [page],
    classificationConfidence,
    fields,
  };
}

// ─── Case 1 · Əliyeva — чистое дело, статус OK ──────────────────────────────
const ALIYEVA = "case-aliyeva";
const A_NAME = "Əliyeva Nərgiz Elşən qızı";
const A_ADDR = "Bakı ş., Nəsimi r., Xətai pr. 12, mənzil 45";
const A_PARCEL = "2-1-045-0123";
const A_AREA = "78.5 m²";

function aliyevaDoc(
  type: DocumentType,
  page: number,
  cc: number,
  extra: ExtractedField[] = [],
): CaseDocument {
  const id = `${ALIYEVA}-doc-${type}`;
  return doc(ALIYEVA, type, page, cc, [
    field(id, page, "applicant_name", "Ərizəçi / Sahibkar", A_NAME, 0.97),
    field(id, page, "address", "Ünvan", A_ADDR, 0.95),
    field(id, page, "parcel_id", "Sahə №", A_PARCEL, 0.96),
    ...extra,
  ]);
}

const aliyevaCase: unknown = {
  id: ALIYEVA,
  applicant: A_NAME,
  address: A_ADDR,
  parcelId: A_PARCEL,
  service: "İlkin dövlət qeydiyyatı",
  status: "ok",
  confidence: 0.95,
  createdAt: "2026-07-16T09:12:00.000Z",
  documents: [
    aliyevaDoc("erize", 1, 0.98),
    aliyevaDoc("sexsiyyet_vesiqesi", 2, 0.97, [
      field(
        `${ALIYEVA}-doc-sexsiyyet_vesiqesi`,
        2,
        "id_number",
        "Ş.V. seriya №",
        "AZE 04512233",
        0.94,
      ),
    ]),
    aliyevaDoc("serencam", 3, 0.93),
    aliyevaDoc("plan_sxem", 4, 0.9, [
      field(
        `${ALIYEVA}-doc-plan_sxem`,
        4,
        "area_sqm",
        "Sahə (m²)",
        A_AREA,
        0.92,
      ),
    ]),
    aliyevaDoc("texniki_pasport", 5, 0.94, [
      field(
        `${ALIYEVA}-doc-texniki_pasport`,
        5,
        "area_sqm",
        "Sahə (m²)",
        A_AREA,
        0.93,
      ),
    ]),
    aliyevaDoc("qebz", 6, 0.96),
  ],
  flags: [],
  checks: [
    {
      type: "completeness",
      result: "pass",
      summary: "Bütün 6 tələb olunan sənəd növü mövcuddur.",
      flagIds: [],
    },
    {
      type: "consistency",
      result: "pass",
      summary: "Açar sahələr bütün sənədlərdə uyğundur (ad, ünvan, sahə №, sahə).",
      flagIds: [],
    },
  ],
};

// ─── Case 2 · Rusadze — подсаженные дефекты (A + C) ─────────────────────────
const RUSADZE = "case-rusadze";
const R_NAME_ERIZE = "Rusadze Tamaz Georgi oğlu";
const R_NAME_ID = "Qusadze Tamaz Georgi oğlu"; // планта: фамилия расходится
const R_ADDR = "Bakı ş., Yasamal r., H. Cavid pr. 31, mənzil 8";
const R_PARCEL = "1-3-112-0087";
const R_AREA_PLAN = "119.0 m²"; // plan-sxem
const R_AREA_TECH = "112.0 m²"; // texniki pasport — расхождение >2%

const rusadzeCase: unknown = {
  id: RUSADZE,
  applicant: R_NAME_ERIZE,
  address: R_ADDR,
  parcelId: R_PARCEL,
  service: "İlkin dövlət qeydiyyatı",
  status: "incomplete",
  confidence: 0.86,
  createdAt: "2026-07-17T14:38:00.000Z",
  documents: [
    doc(RUSADZE, "erize", 1, 0.97, [
      field(
        `${RUSADZE}-doc-erize`,
        1,
        "applicant_name",
        "Ərizəçi / Sahibkar",
        R_NAME_ERIZE,
        0.95,
      ),
      field(`${RUSADZE}-doc-erize`, 1, "address", "Ünvan", R_ADDR, 0.93),
      field(`${RUSADZE}-doc-erize`, 1, "parcel_id", "Sahə №", R_PARCEL, 0.94),
    ]),
    doc(RUSADZE, "sexsiyyet_vesiqesi", 2, 0.9, [
      field(
        `${RUSADZE}-doc-sexsiyyet_vesiqesi`,
        2,
        "applicant_name",
        "Ş.V. üzrə ad",
        R_NAME_ID,
        0.72,
      ),
      field(
        `${RUSADZE}-doc-sexsiyyet_vesiqesi`,
        2,
        "id_number",
        "Ş.V. seriya №",
        "AZE 07781902",
        0.91,
      ),
    ]),
    doc(RUSADZE, "serencam", 3, 0.88, [
      field(
        `${RUSADZE}-doc-serencam`,
        3,
        "applicant_name",
        "Sahibkar",
        R_NAME_ERIZE,
        0.9,
      ),
      field(`${RUSADZE}-doc-serencam`, 3, "parcel_id", "Sahə №", R_PARCEL, 0.92),
    ]),
    doc(RUSADZE, "plan_sxem", 4, 0.87, [
      field(`${RUSADZE}-doc-plan_sxem`, 4, "address", "Ünvan", R_ADDR, 0.89),
      field(
        `${RUSADZE}-doc-plan_sxem`,
        4,
        "area_sqm",
        "Sahə (m²)",
        R_AREA_PLAN,
        0.9,
      ),
    ]),
    doc(RUSADZE, "texniki_pasport", 5, 0.91, [
      field(
        `${RUSADZE}-doc-texniki_pasport`,
        5,
        "address",
        "Ünvan",
        R_ADDR,
        0.9,
      ),
      field(
        `${RUSADZE}-doc-texniki_pasport`,
        5,
        "area_sqm",
        "Sahə (m²)",
        R_AREA_TECH,
        0.88,
      ),
    ]),
    // qebz (квитанция) — ОТСУТСТВУЕТ: провал полноты (A).
  ],
  flags: [
    {
      id: `${RUSADZE}-flag-missing-qebz`,
      checkType: "completeness",
      kind: "missing_document",
      severity: "high",
      title: "Yoxdur: Qəbz",
      description:
        "İlkin qeydiyyat üçün tələb olunan «Qəbz» (dövlət rüsumunun ödənişi) sənəd dəstində aşkarlanmadı.",
      documentId: null,
      pageNumber: null,
      discrepancy: null,
      decision: "pending",
      decisionNote: null,
    },
    {
      id: `${RUSADZE}-flag-surname`,
      checkType: "consistency",
      kind: "field_discrepancy",
      severity: "high",
      title: "Soyad uyğunsuzluğu: Rusadze / Qusadze",
      description:
        "Ərizədə soyad «Rusadze», şəxsiyyət vəsiqəsində «Qusadze» kimi göstərilib. Şəxsin eyniliyi təsdiqlənməlidir.",
      documentId: `${RUSADZE}-doc-sexsiyyet_vesiqesi`,
      pageNumber: 2,
      discrepancy: {
        fieldKey: "applicant_name",
        fieldLabel: "Ərizəçi / Sahibkar",
        kind: "text",
        values: [
          {
            documentId: `${RUSADZE}-doc-erize`,
            documentTitle: "Ərizə",
            value: R_NAME_ERIZE,
          },
          {
            documentId: `${RUSADZE}-doc-sexsiyyet_vesiqesi`,
            documentTitle: "Şəxsiyyət vəsiqəsi",
            value: R_NAME_ID,
          },
        ],
        deltaPercent: null,
      },
      decision: "pending",
      decisionNote: null,
    },
    {
      id: `${RUSADZE}-flag-area`,
      checkType: "consistency",
      kind: "field_discrepancy",
      severity: "medium",
      title: "Sahə uyğunsuzluğu: 119.0 / 112.0 m²",
      description:
        "Plan-sxemdə sahə 119.0 m², texniki pasportda 112.0 m². Fərq 6.25% — ±2% həddindən yüksək, Flag qoyulur.",
      documentId: `${RUSADZE}-doc-texniki_pasport`,
      pageNumber: 5,
      discrepancy: {
        fieldKey: "area_sqm",
        fieldLabel: "Sahə (m²)",
        kind: "area",
        values: [
          {
            documentId: `${RUSADZE}-doc-plan_sxem`,
            documentTitle: "Plan-sxem",
            value: R_AREA_PLAN,
          },
          {
            documentId: `${RUSADZE}-doc-texniki_pasport`,
            documentTitle: "Texniki pasport",
            value: R_AREA_TECH,
          },
        ],
        deltaPercent: 6.25,
      },
      decision: "pending",
      decisionNote: null,
    },
  ],
  checks: [
    {
      type: "completeness",
      result: "fail",
      summary: "6 tələb olunan sənəddən 5-i mövcuddur. Yoxdur: Qəbz.",
      flagIds: [`${RUSADZE}-flag-missing-qebz`],
    },
    {
      type: "consistency",
      result: "fail",
      summary: "2 uyğunsuzluq: soyad (Rusadze/Qusadze) və sahə (>2%).",
      flagIds: [`${RUSADZE}-flag-surname`, `${RUSADZE}-flag-area`],
    },
  ],
};

/** Валидируем фикстуры схемой на старте — фикстура-дефект ловится тут же. */
export function loadFixtures(): TCase[] {
  return [Case.parse(aliyevaCase), Case.parse(rusadzeCase)];
}
