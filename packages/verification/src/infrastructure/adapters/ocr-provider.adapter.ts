import { Injectable } from "@nestjs/common";

import { OcrProvider } from "../../application/ports/outbound/index.js";
import {
  Confidence,
  OcrResult,
  type PageImage,
  RecognisedText,
} from "../../domain/value-objects/index.js";

const MOCK_OCR_LATENCY_MS = 1200;

@Injectable()
export class OcrProviderAdapter extends OcrProvider {
  // Nothing throttles a fake, so a whole file's worth of pages can go at once
  // and the mock keeps a demo as quick as it is convincing.
  override readonly pagesAtOnce = 8;

  async recognise(image: PageImage): Promise<OcrResult> {
    await new Promise((r) => setTimeout(r, MOCK_OCR_LATENCY_MS));

    const key = image.storageKey.value;
    // More than the last segment, because a page rendered off a PDF is named
    // after its number and carries the uploaded filename in its folder — but not
    // the random prefix the presign step put in front, whose hex spells "deed"
    // often enough to matter.
    const text = fakeText(key.slice(key.indexOf("/") + 1));
    // Deterministic in [0.82, 0.97], so a re-run reports the same number.
    const confidence = 0.82 + (hash(key) % 16) / 100;

    return OcrResult.of(RecognisedText.of(text), Confidence.of(confidence));
  }
}

// Keyed off the uploaded filename, and written the way the real papers read —
// Azerbaijani headings, Russian subtitles — so a mocked run exercises the same
// classification the live providers are asked to do.
function fakeText(key: string): string {
  const name = key.toLowerCase();

  if (
    name.includes("vesiqe") ||
    name.includes("vəsiqə") ||
    name.includes("identity") ||
    name.includes("passport")
  ) {
    return [
      "AZƏRBAYCAN RESPUBLİKASI",
      "ŞƏXSİYYƏT VƏSİQƏSİ / УДОСТОВЕРЕНИЕ ЛИЧНОСТИ",
      "Soyadı / Фамилия: ƏLİYEV",
      "Adı / Имя: ELÇİN",
      "Vəsiqə No: AZE1234567",
      "Verilmə tarixi: 12.02.2021",
      "Etibarlıdır: 21.09.2030",
    ].join("\n");
  }
  if (
    name.includes("plan") ||
    name.includes("sxem") ||
    name.includes("torpaq")
  ) {
    return [
      "TORPAQ SAHƏSİNİN PLAN-SXEMİ",
      "ПЛАН-СХЕМА ЗЕМЕЛЬНОГО УЧАСТКА",
      "Ünvan / Адрес: Bakı ş., Nəsimi r., Azadlıq pr. 12, mən. 43",
      "Kadastr nömrəsi: AZ-CAD-1024-311",
      "Sahə: 642 m2",
      "Sahibi: ELÇİN ƏLİYEV",
      "Tarix: 27.09.2025",
    ].join("\n");
  }
  if (
    name.includes("serencam") ||
    name.includes("sərəncam") ||
    name.includes("order") ||
    name.includes("rasporyaj")
  ) {
    return [
      "SƏRƏNCAMDAN ÇIXARIŞ",
      "ВЫПИСКА ИЗ РАСПОРЯЖЕНИЯ",
      "Sərəncam No: R-1147",
      "Verən orqan: Bakı Şəhər İcra Hakimiyyəti",
      "Verilmə tarixi: 12.02.2021",
      "Ərizəçi: ELÇİN ƏLİYEV",
      "Ünvan: Bakı ş., Nəsimi r., Azadlıq pr. 12",
      "Sahə: 642 m2",
    ].join("\n");
  }
  if (
    name.includes("qebz") ||
    name.includes("qəbz") ||
    name.includes("odenis") ||
    name.includes("ödəniş") ||
    name.includes("receipt") ||
    name.includes("kvitan")
  ) {
    return [
      "ÖDƏNİŞ QƏBZİ / КВИТАНЦИЯ ОБ ОПЛАТЕ",
      "Qəbz No: QB-2025-88301",
      "Ödəyici: ELÇİN ƏLİYEV",
      "Məbləğ: 60,00 AZN",
      "Ödəniş tarixi: 05.11.2025",
      "Təyinat: Dövlət qeydiyyatı üçün dövlət rüsumu",
    ].join("\n");
  }
  if (
    name.includes("eskiz") ||
    name.includes("layihe") ||
    name.includes("layihə") ||
    name.includes("sketch") ||
    name.includes("proekt")
  ) {
    return [
      "ESKİZ LAYİHƏSİ / ЭСКИЗНЫЙ ПРОЕКТ",
      "Layihənin adı: Fərdi yaşayış evi — eskiz layihə",
      'Layihə təşkilatı: "AzMemarLayihə" MMC',
      "Ünvan: Bakı ş., Nəsimi r., Azadlıq pr. 12",
      "Ümumi sahə: 248 m2",
      "Mərtəbələrin sayı: 2",
      "Təsdiq tarixi: 18.12.2025",
    ].join("\n");
  }
  if (
    name.includes("arxiv") ||
    name.includes("arayis") ||
    name.includes("arayış") ||
    name.includes("archive") ||
    name.includes("spravka")
  ) {
    return [
      "ARXİV ARAYIŞI / АРХИВНАЯ СПРАВКА",
      "Arayış No: ARX-2025-0417",
      "Verən orqan: Bakı Şəhər Dövlət Arxivi",
      "Verilmə tarixi: 12.02.2021",
      "Ünvan: Bakı ş., Nəsimi r., Azadlıq pr. 12",
      "Sahibi: ELÇİN ƏLİYEV",
    ].join("\n");
  }
  if (
    name.includes("erize") ||
    name.includes("ərizə") ||
    name.includes("qeydiyyat") ||
    name.includes("application") ||
    name.includes("zayavlenie")
  ) {
    return [
      "DÖVLƏT QEYDİYYATI HAQQINDA ƏRİZƏ",
      "ЗАЯВЛЕНИЕ О ГОСУДАРСТВЕННОЙ РЕГИСТРАЦИИ",
      "Ərizəçi / Заявитель: ELÇİN ƏLİYEV",
      "Şəxsiyyət vəsiqəsi No: AZE1234567",
      "Ünvan: Bakı ş., Nəsimi r., Azadlıq pr. 12, mən. 43",
      "Kadastr nömrəsi: AZ-CAD-1024-311",
      "Tarix: 03.11.2025",
    ].join("\n");
  }

  return `SƏNƏD / DOCUMENT\nİstinad: ${key}\n(no distinguishing text recognised)`;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
