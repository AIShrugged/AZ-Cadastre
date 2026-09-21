import { Injectable } from '@nestjs/common';

import { OcrProvider } from '../../application/ports/outbound/index.js';
import {
  Confidence,
  OcrResult,
  RecognisedText,
  type PageImage,
} from '../../domain/value-objects/index.js';

const MOCK_OCR_LATENCY_MS = 1200;

@Injectable()
export class OcrProviderAdapter extends OcrProvider {
  // Nothing throttles a fake, so a whole file's worth of pages can go at once
  // and the mock keeps a demo as quick as it is convincing.
  override readonly pagesAtOnce = 8;

  async recognise(image: PageImage): Promise<OcrResult> {
    await new Promise(r => setTimeout(r, MOCK_OCR_LATENCY_MS));

    const key = image.storageKey.value;
    // More than the last segment, because a page rendered off a PDF is named
    // after its number and carries the uploaded filename in its folder — but not
    // the random prefix the presign step put in front, whose hex spells "deed"
    // often enough to matter.
    const text = fakeText(key.slice(key.indexOf('/') + 1));
    // Deterministic in [0.82, 0.97], so a re-run reports the same number.
    const confidence = 0.82 + (hash(key) % 16) / 100;

    return OcrResult.of(RecognisedText.of(text), Confidence.of(confidence));
  }
}

// Keyed off the uploaded filename, and written the way the real papers read —
// Azerbaijani headings, Russian subtitles, and the seals and signatures the
// office that issued each of them presses on it, marked as the reader is asked
// to mark them — so a mocked run exercises the same classification and the same
// attestation check the live providers are asked to answer (ADR-0012).
function fakeText(key: string): string {
  const name = key.toLowerCase();

  // Asked before every other branch, because the sheet is an allotment order
  // and its filename says so twice: the words a 1998 order is filed under —
  // "sərəncam", "qərar", "torpaq" — would otherwise be answered by the papers
  // of the current Əliyev case. It is the number that tells them apart, so the
  // year's own order is read off `1471` (or off `həyətyanı`, the plot it
  // allots), and a plain `serencam.pdf` still reads as the extract below.
  //
  // The Rusadze case: the archive's certified copy of the order allotting the
  // homestead plot, held against the National Archive Fund by the QR reference
  // printed on it (ADR-0028). Every line DECREE_439_FIELDS asks of such a paper
  // is on it, worded as the offline extractor reads it and referenced as the
  // offline archive holds it — DECREE_439_VALUES in field-extractor.adapter.ts
  // and HELD in national-archive.adapter.ts, which rusadze-order.spec.ts holds
  // together with this sheet. The surname is the 1998 spelling, which order 396
  // of 2021 later corrected to Rusadze.
  if (
    name.includes('1471') ||
    name.includes('heyetyani') ||
    name.includes('həyətyanı') ||
    name.includes('priusadeb')
  ) {
    return [
      'AZƏRBAYCAN RESPUBLİKASI',
      'SABUNÇU RAYON İCRA HAKİMİYYƏTİ',
      'Həyətyanı torpaq sahəsinin ayrılması barədə qərar № 1471, 29.10.1998',
      'РЕШЕНИЕ ОБ ОТВОДЕ ПРИУСАДЕБНОГО ЗЕМЕЛЬНОГО УЧАСТКА',
      'Verən orqan: Sabunçu Rayon İcra Hakimiyyəti',
      'Qusadze Vera Vladimirovna — 400,0 kv.m',
      'Ünvan: Sabunçu rayonu, 1-ci Zabrat qəsəbəsindən yeni məhəlləyə gedən ' +
        'yolun solunda',
      '439 saylı Fərmanın 2.7-ci bəndi',
      'EAS: Fond-130, siy.1, i-476, vər.98',
      'QR: https://qr.esd.milliarxiv.gov.az/F130-S1-I476-V98',
      '[stamp: SABUNÇU RAYON İCRA HAKİMİYYƏTİ]',
      '[signature]',
    ].join('\n');
  }
  if (
    name.includes('vesiqe') ||
    name.includes('vəsiqə') ||
    name.includes('identity') ||
    name.includes('passport')
  ) {
    return [
      'AZƏRBAYCAN RESPUBLİKASI',
      'ŞƏXSİYYƏT VƏSİQƏSİ / УДОСТОВЕРЕНИЕ ЛИЧНОСТИ',
      'Soyadı / Фамилия: ƏLİYEV',
      'Adı / Имя: ELÇİN',
      'Vəsiqə No: AZE1234567',
      'Verilmə tarixi: 12.02.2021',
      'Etibarlıdır: 21.09.2030',
    ].join('\n');
  }
  if (
    name.includes('plan') ||
    name.includes('sxem') ||
    name.includes('torpaq')
  ) {
    return [
      'TORPAQ SAHƏSİNİN PLAN-SXEMİ',
      'ПЛАН-СХЕМА ЗЕМЕЛЬНОГО УЧАСТКА',
      'Ünvan / Адрес: Bakı ş., Nəsimi r., Azadlıq pr. 12, mən. 43',
      'Kadastr nömrəsi: AZ-CAD-1024-311',
      'Sahə: 642 m2',
      'Sahibi: ELÇİN ƏLİYEV',
      'Tarix: 27.09.2025',
      '[stamp: BAKI ŞƏHƏR DÖVLƏT TORPAQ VƏ XƏRİTƏÇƏKMƏ KOMİTƏSİ]',
      '[signature]',
    ].join('\n');
  }
  if (
    name.includes('serencam') ||
    name.includes('sərəncam') ||
    name.includes('order') ||
    name.includes('rasporyaj')
  ) {
    return [
      'SƏRƏNCAMDAN ÇIXARIŞ',
      'ВЫПИСКА ИЗ РАСПОРЯЖЕНИЯ',
      'Sərəncam No: R-1147',
      'Verən orqan: Bakı Şəhər İcra Hakimiyyəti',
      'Verilmə tarixi: 12.02.2021',
      'Ərizəçi: ELÇİN ƏLİYEV',
      'Ünvan: Bakı ş., Nəsimi r., Azadlıq pr. 12',
      'Sahə: 642 m2',
      '[stamp: BAKI ŞƏHƏR İCRA HAKİMİYYƏTİ]',
      '[signature]',
    ].join('\n');
  }
  if (
    name.includes('qebz') ||
    name.includes('qəbz') ||
    name.includes('odenis') ||
    name.includes('ödəniş') ||
    name.includes('receipt') ||
    name.includes('kvitan')
  ) {
    return [
      'ÖDƏNİŞ QƏBZİ / КВИТАНЦИЯ ОБ ОПЛАТЕ',
      'Qəbz No: QB-2025-88301',
      'Ödəyici: ELÇİN ƏLİYEV',
      'Məbləğ: 60,00 AZN',
      'Ödəniş tarixi: 05.11.2025',
      'Təyinat: Dövlət qeydiyyatı üçün dövlət rüsumu',
    ].join('\n');
  }
  if (
    name.includes('eskiz') ||
    name.includes('layihe') ||
    name.includes('layihə') ||
    name.includes('sketch') ||
    name.includes('proekt')
  ) {
    return [
      'ESKİZ LAYİHƏSİ / ЭСКИЗНЫЙ ПРОЕКТ',
      'Layihənin adı: Fərdi yaşayış evi — eskiz layihə',
      'Layihə təşkilatı: "AzMemarLayihə" MMC',
      'Ünvan: Bakı ş., Nəsimi r., Azadlıq pr. 12',
      'Ümumi sahə: 248 m2',
      'Mərtəbələrin sayı: 2',
      'Təsdiq tarixi: 18.12.2025',
      '[stamp: "AzMemarLayihə" MMC]',
      '[signature]',
    ].join('\n');
  }
  if (
    name.includes('arxiv') ||
    name.includes('arayis') ||
    name.includes('arayış') ||
    name.includes('archive') ||
    name.includes('spravka')
  ) {
    return [
      'ARXİV ARAYIŞI / АРХИВНАЯ СПРАВКА',
      'Arayış No: ARX-2025-0417',
      'Verən orqan: Bakı Şəhər Dövlət Arxivi',
      'Verilmə tarixi: 12.02.2021',
      'Ünvan: Bakı ş., Nəsimi r., Azadlıq pr. 12',
      'Sahibi: ELÇİN ƏLİYEV',
      '[stamp: BAKI ŞƏHƏR DÖVLƏT ARXİVİ]',
      '[signature]',
    ].join('\n');
  }
  if (
    name.includes('erize') ||
    name.includes('ərizə') ||
    name.includes('qeydiyyat') ||
    name.includes('application') ||
    name.includes('zayavlenie')
  ) {
    return [
      'DÖVLƏT QEYDİYYATI HAQQINDA ƏRİZƏ',
      'ЗАЯВЛЕНИЕ О ГОСУДАРСТВЕННОЙ РЕГИСТРАЦИИ',
      'Ərizəçi / Заявитель: ELÇİN ƏLİYEV',
      'Şəxsiyyət vəsiqəsi No: AZE1234567',
      'Ünvan: Bakı ş., Nəsimi r., Azadlıq pr. 12, mən. 43',
      'Kadastr nömrəsi: AZ-CAD-1024-311',
      'Tarix: 03.11.2025',
      '[signature]',
    ].join('\n');
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
