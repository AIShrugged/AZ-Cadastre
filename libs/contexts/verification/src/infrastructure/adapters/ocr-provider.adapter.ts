import { Injectable } from "@nestjs/common";

import { OcrProvider } from "../../application/ports/index.js";
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

  if (name.includes("qeydiyyat") || name.includes("registration")) {
    return [
      "DAŞINMAZ ƏMLAK ÜZƏRİNDƏ HÜQUQLARIN DÖVLƏT QEYDİYYATI HAQQINDA ƏRİZƏ",
      "ЗАЯВЛЕНИЕ О ГОСУДАРСТВЕННОЙ РЕГИСТРАЦИИ ПРАВ НА НЕДВИЖИМОЕ ИМУЩЕСТВО",
      "Ərizəçi / Заявитель: ELÇİN ƏLİYEV",
      "Şəxsiyyət vəsiqəsi No: AZE1234567",
      "Ünvan: Bakı ş., Nəsimi r., Azadlıq pr. 12, mən. 43",
      "Kadastr nömrəsi: AZ-CAD-1024-311",
      "Qeydiyyat orqanı: Əmlak Məsələləri Dövlət Xidməti",
      "Tarix: 03.11.2025",
    ].join("\n");
  }
  if (
    name.includes("bildiris") ||
    name.includes("bildiriş") ||
    name.includes("notification")
  ) {
    return [
      "BİLDİRİŞ İCRAATI QAYDASINDA ƏRİZƏ",
      "ЗАЯВЛЕНИЕ В ПОРЯДКЕ УВЕДОМИТЕЛЬНОГО ПРОИЗВОДСТВА",
      "Ərizəçi: ELÇİN ƏLİYEV",
      "Ünvan: Bakı ş., Nəsimi r., Azadlıq pr. 12",
      "Kadastr nömrəsi: AZ-CAD-1024-311",
      "Tikintinin təyinatı: Fərdi yaşayış evinin tikintisi",
      "Tarix: 03.11.2025",
    ].join("\n");
  }
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
    name.includes("memarliq") ||
    name.includes("eskiz") ||
    name.includes("architect")
  ) {
    return [
      "MEMARLIQ-PLANLAŞDIRMA HƏLLİ (ESKİZ LAYİHƏ)",
      "АРХИТЕКТУРНО-ПЛАНИРОВОЧНОЕ РЕШЕНИЕ (ЭСКИЗНЫЙ ПРОЕКТ)",
      "Layihənin adı: Fərdi yaşayış evi — eskiz layihə",
      'Layihə təşkilatı: "AzMemarLayihə" MMC',
      "Ünvan: Bakı ş., Nəsimi r., Azadlıq pr. 12",
      "Kadastr nömrəsi: AZ-CAD-1024-311",
      "Ümumi sahə: 642 m2",
      "Təsdiq tarixi: 18.12.2025",
    ].join("\n");
  }
  if (name.includes("elave") || name.includes("əlavə") || name.includes("annex")) {
    return [
      "LİSENZİYAYA ƏLAVƏ",
      "ПРИЛОЖЕНИЕ К ЛИЦЕНЗИИ",
      "Lisenziya No: AZ-LIC-2019-4471",
      "Əlavə No: 1",
      'Lisenziya sahibi: "AzMemarLayihə" MMC',
      "Əhatə olunan işlər: Tikinti layihələndirilməsi",
      "Verilmə tarixi: 12.02.2021",
    ].join("\n");
  }
  if (name.includes("lisenziya") || name.includes("licen")) {
    return [
      "LİSENZİYA / ЛИЦЕНЗИЯ",
      "Lisenziya No: AZ-LIC-2019-4471",
      'Lisenziya sahibi: "AzMemarLayihə" MMC',
      "Fəaliyyət növü: Tikinti layihələndirilməsi",
      "Verən orqan: Dövlət Şəhərsalma və Arxitektura Komitəsi",
      "Verilmə tarixi: 12.02.2021",
      "Etibarlıdır: 21.09.2030",
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
