/**
 * Builds the archive-register fixtures under `fixtures/archive/`: the six
 * workbooks the customer stores, each carrying records instead of nothing.
 *
 * The six files as shipped are schema sheets. Every one of them documents
 * itself in its first rows — the office's Azerbaijani headers, an English
 * translation, a description of each column, one example row — and then stops,
 * because what the customer sent was the *shape* of each register and not its
 * contents. There is therefore nothing to upload and nothing to prove the import
 * against, which is what these are for.
 *
 * They are built from the customer's own files rather than written out here, so
 * the preamble cannot drift: the script opens each source workbook, keeps every
 * row the sheet labels as its own documentation, drops the example row, and
 * writes the records under it with the label column left blank. A fixture is
 * therefore the customer's file with rows in it and not an imitation of one — if
 * the office sends a corrected schema, re-running this picks it up.
 *
 * The records are off the customer's own application packages, the three in
 * `Fedor Zhernovoy/INPUTS/` above all: the Bülbülə land plot of Əliyeva Əsmər
 * Sadıq qızı, which is the case the end-to-end scenario runs. Where a value is
 * invented it is because the register's column has no counterpart on the papers
 * — a folder number, a page range — and it is marked below.
 *
 * Every address here is one no seeded record answers to. That is deliberate and
 * load-bearing: two records at one address is an `Ambiguous` lookup, which is a
 * real answer the seed already demonstrates, and a fixture that produced it by
 * accident would break the case it is meant to prove.
 *
 * Run with `pnpm --filter @cadastre/registry-stub fixtures:archive`.
 */
import fs from 'node:fs';
import path from 'node:path';

import ExcelJS from 'exceljs';

/** The customer's own files, from this script's place in the repository. */
const SOURCES = path.join(
  import.meta.dirname,
  '..',
  '..',
  '..',
  'Fedor Zhernovoy',
);
const OUT = path.join(import.meta.dirname, 'archive');

/** What column A of a documented sheet says. Anything else is a record. */
const LABEL = /^(column headers|column descriptions|example row|⚠|structural note|information on )/iu; // prettier-ignore
const HEADER_LABEL = /^column headers/i;

// ── The records ─────────────────────────────────────────────────────────────
// Keyed by the sheet's own Azerbaijani header, so a column that moves moves with
// them. A header these do not name is left blank, which is what the register
// reads as "the source did not carry this".

/*
 * The case the whole scenario turns on: `INPUTS/AZkadastr.pdf`, the application
 * of Əliyeva Əsmər Sadıq qızı over a land plot in Bülbülə, and the extract from
 * the state register printed inside it. Register number, registration number and
 * date, both spellings of the address, the area in hectares and the notarial
 * sale contract it was bought under are all off that package. The folder, the
 * page range and the archive inventory number are not on any of its papers and
 * are invented: the archive's own locator is the one thing an application never
 * carries, and it is the most useful thing the register has for an inspector.
 */
const BULBULE = {
  Rayon: 'Suraxanı',
  'Şəhadətnamə verilir (Hüquqi şəxsin adı / Fiziki şəxsin S.A.A.)':
    'Əliyeva Əsmər Sadıq qızı',
  Obyekt: 'Torpaq sahəsi',
  Ünvan:
    'AZ 1112, Bakı şəhəri, Suraxanı rayonu, Bülbülə qəsəbəsi, ' +
    'Xankəndi küçəsi, giriş 23',
  // As the privatisation registers write one: the number and its date fused
  // into a single cell, irregular spacing and all.
  Şəhadətnamə: '4a-303     11.02.2026',
  Qovluq: '112',
  'Səhifə (başlanğıc)': '01-dən 24',
  'Səhifə (son)': 'DƏK',
  // Whom the plot was bought from, under the notarial contract named above.
  'İlkin mülkiyyətçi': 'Həsənov Elşad Nizami oğlu',
  'Qeydiyyat nömrəsi': '1126037281',
  'Reyestr nömrəsi': '006013025906',
  'Qeydiyyat nömrəsi (arxiv)': '1126060498',
  // `Köhnə ünvan`, printed under the current one in the same cell of the
  // extract: the form the plot carried before the settlement was addressed.
  'Ünvan 2 (arxiv)': 'Bakı şəhəri, Suraxanı rayonu, Bülbülə qəsəbəsi',
  'İnventar (arxiv)': '25906',
  Qeyd:
    'Alqı-satqı müqaviləsi, Bakı şəhəri 50 saylı notariat ofisi, ' +
    'xüsusi notarius Rəhmanov Kənan Akif oğlu',
};

// `Mulkuyat` has no area column, so the register holds no figure for this plot
// and answers `NotRecorded` when asked about one — which is the ordinary case
// and not a shortfall (`ArchiveRecordDto`). The extract in the package puts it
// at 0.0201 ha; putting the same plot in `Torpaq`, which does have the column,
// would key it a second time by its certificate number and leave two records at
// one address.

const EMDK_ROWS = {
  Mulkuyat: [BULBULE],
  // Two historical land sales, in the shape and the wording of the sheet's own
  // example row and at addresses nothing else in the register answers to.
  Torpaq: [
    {
      Sıra: '1',
      'Rayonun adı': 'Nərimanov',
      'Alıcının adı': '"Dürcan" firması',
      'Obyektin adı': 'qeyri-yaşayış sahəsi',
      'Torpaq sahəsi (kv.m.)': '12595.3',
      Ünvanı: 'Xarici dairəvi, 2061-ci məhəllə',
      'Şəhadətnamə №-si': '000902     19.03.1999',
      Qovluq: '6',
      'Səhifə (başlanğıc)': '01-dən 30',
      'Səhifə (son)': 'DƏK',
    },
    {
      Sıra: '2',
      'Rayonun adı': 'Xətai',
      'Alıcının adı': '"Caspian Petrol-1" firması',
      'Obyektin adı': 'əmlak kompleksinin yerləşdiyi torpaq sahəsi',
      'Torpaq sahəsi (kv.m.)': '5002.5',
      Ünvanı: 'Y.Səfərov küçəsi, 19',
      'Şəhadətnamə №-si': '002490     29.03.2010',
      Qovluq: '18',
      'Səhifə (başlanğıc)': '01-dən 41',
    },
  ],
  'Baki-auksion': [
    {
      'Sıra №-si': '1',
      Rayon: 'Xətai',
      'Obyektin adı': '1 saylı avtomağazası',
      'Fiziki şəxsin adı': 'Həsənova Fatma Əsgər qızı',
      Ünvanı: 'Y.Səfərov-1',
      Şəhadətnamə: '08812     12.01.1998',
      Qovluq: '19',
      Səhifə: '92-129',
    },
  ],
  emdk: [
    {
      'Sıra №-si': '1',
      Rayon: 'Səbail',
      'Əmlakın tərkibi (Obyektin adı)': '125 saylı pavilyon',
      'Müqavilə verilir (Fiziki şəxsin adı)': 'Rəsulov Elşən Həsən oğlu',
      'Əmlakın ümumi sahəsi': '41,1',
      Ünvanı: '20-ci sahə dairəsi',
      'Müqavilənin nömrəsi': 'm.2063, 02.09.2009',
      Qovluq: '1',
      'Səhifə (başlanğıc)': '01-dən 31',
    },
  ],
};

/*
 * Two handover cases in the shape the Hövsan registers carry: both offices'
 * registration and register numbers on one row, the holder before and the
 * holder after. Each row becomes two objects, one per office, and each holds
 * the other's numbers — which is the whole reason the register keys an object
 * by its office (ADR-0010).
 *
 * Not the case in the seed. Importing a second record of a house the register
 * already holds would leave two records at one address, and a lookup that
 * answered `Ambiguous` where the scenario expects a record would be a fixture
 * breaking the thing it exists to prove.
 */
const HOVSAN_ROWS = {
  'qəbul edilən': [
    {
      'Sıra №-si': '1',
      'İnventar №': '2088',
      'Abşeron Ə.İ üzrə qeydiyyat nömrəsi': '1608002040',
      'AbşeronƏ.İ reyestr nömrəsi': '308011000714',
      'Hüquq sahibi (-ləri)': 'Yusubova Gülmira Ramis qızı',
      // A street, and not the `Donuzkökəltmə sahəsi` the sheet's own example row
      // uses. `addressesAgree` compares only the levels both spellings name, so
      // a plot with no street named agrees with every house on the same
      // qəsəbə — including the seeded handover case — and two records at one
      // address is an `Ambiguous` lookup.
      Ünvan: 'Bakı şəhəri, Xəzər rayonu, Hövsan qəsəbəsi, Zeytun küçəsi, ev 12',
      Qeyd: 'birləşdirilib',
      'Bakı Əİ üzrə qeydiyyat nömrəsi': '1119038649',
      'Bakı Əİ üzrə reyestr nömrəsi': '006011006721',
      'Yeni Hüquq sahibləri': 'Yusubov Ramin Elşad oğlu',
    },
    {
      'Sıra №-si': '2',
      'İnventar №': '2091',
      'Abşeron Ə.İ üzrə qeydiyyat nömrəsi': '1608002051',
      'AbşeronƏ.İ reyestr nömrəsi': '308011000731',
      'Hüquq sahibi (-ləri)': '"Zeytun" kollektiv müəssisəsi',
      Ünvan: 'Bakı şəhəri, Suraxanı rayonu, Zeytun sovxozu, sahə 5',
      'Bakı Əİ üzrə qeydiyyat nömrəsi': '1119038702',
      'Bakı Əİ üzrə reyestr nömrəsi': '006011006744',
    },
  ],
};

/*
 * The non-residential register book of the former technical inventory office,
 * in the Azerbaijani legacy Cyrillic code page — not Russian: `ə` typed as `я`,
 * `ü` as `ц`, `ğ` as `ь`. A submission written in Latin has to resolve to these,
 * which is what the address rules' code-page table is for.
 */
const QEYRI_ROWS = {
  Sheet1: [
    {
      '№': '1',
      Тарих: '21.07.2003',
      'Рейестр №-си': '357',
      Цнван: 'Гарачухур Сураханы йол.кясишдийи',
      'Мцлкиййятин там Ады': 'Сцлейманов Аьаверди Мяммяд оьлу',
      'Рейестр китабындан чыхарылма щаг-да гейд': '17.06.2004 а/с',
    },
    {
      '№': '2',
      Тарих: '14.11.2003',
      'Рейестр №-си': '412',
      Цнван: 'Бинягяди району, 8-ъи мкр, Ъ.Ъаббарлы кцчяси 14',
      'Мцлкиййятин там Ады': 'Ялийев Тофиг Ъялил оьлу',
    },
  ],
};

/*
 * The technical passports held for non-residential property. Four columns and
 * no key of any kind, so the register keys these by their own row in their own
 * book — which is how the archive finds them, and which is written out as the
 * sheet and the row so nobody mistakes it for a register number.
 */
const TEXPASPORT_ROWS = {
  'List 1 ': [
    {
      'Sıra №': '1',
      Rayon: 'Nizami',
      Ünvanı: 'Babək pr. Məhəllə 2269',
      'Mülkiyyətin tam adı': '"Qərənfil 97" firması',
    },
    {
      'Sıra №': '2',
      Rayon: 'Suraxanı',
      Ünvanı: 'Bülbülə qəsəbəsi, Xankəndi küçəsi 40',
      'Mülkiyyətin tam adı': 'Quliyev Sirus Məhəmməd oğlu',
    },
    {
      'Sıra №': '3',
      Rayon: 'Sabunçu',
      Ünvanı: 'Bakıxanov qəsəbəsi, Salyan şossesi 12',
      'Mülkiyyətin tam adı': '"Leyla-M" firması',
    },
  ],
};

/*
 * The Land Committee's registers. These carry no address column at all, which
 * is not an oversight in the fixture: the sheets are indexes by holder and act
 * number, and a record read out of one answers to its numbers and not to a
 * place. It is worth importing for exactly that — an object the register holds
 * and cannot find by address is the shape of half the archive.
 */
const TORPAQ_ROWS = {
  'DÖVLƏT AKTI': [
    {
      'Sıra №-si': '23',
      'Soyadı adı atasının adı': '"Leyla-M" Firması',
      '№JN': '0786',
      QEYD: '481042',
    },
    {
      'Sıra №-si': '24',
      'Soyadı adı atasının adı': 'Əhmədov İsrafil Sabir oğlu',
      '№JN': '00303027163000309',
      QEYD: '422914',
    },
  ],
  'İcarə müqaviləsi': [
    {
      'Sıra №-si': '15',
      'Soyadı adı atasının adı': '"SEYRAN" MMC',
      '№JN': '9204',
      QEYD: '540928',
    },
  ],
};

/*
 * The technical passport database, the sixth register and the one the seed's
 * Cyrillic case was written off: `Лист4` of the file as shipped carries exactly
 * the Qusar mill workshop the seed holds under register number 2257, down to the
 * `2 (ики)` in its storey column.
 *
 * The rows here are two others in the same shape. The second is what makes the
 * region part of the key rather than decoration: it is passport number 2257 as
 * well, in Sumqayıt, and it is a different building. A register keyed by the
 * number alone would have merged the two (ADR-0010, ADR-0012 §5).
 */
const PASBAZA_ROWS = {
  Лист4: [
    {
      'Сыра №': '1',
      Ил: '2008',
      Реэион: 'Губа',
      'Обйектин ады': 'Гейри йашайыш сащяси - Коммерсийа маьазасы',
      Цнван: 'Губа шящяри, М.Горки кцчяси',
      'Баланс сах./Мцлкиййятчи': 'Щцсейнов Низами Рза оьлу',
      'Цмуми сащя': '66',
      'Ясас сащя': '66',
      'Йардымчы сащя': '0',
      'Торпаг сащяси': '80',
      'Паспорт нюмряси': '6',
      'Тяртиб едилмя тарихи': '09.01.2008',
      'Инвентар нюмряси': '19094',
      'Тикилиалты сащя': '80',
    },
  ],
  Лист2: [
    {
      'Сыра №': '1',
      Ил: '2007',
      Реэион: 'Сумгайыт ш.',
      'Обйектин ады': 'Гейри йашайыш сащяси',
      Цнван: 'Сумгайыт шящяри, 21-ъи мящялля, бина-2/11',
      'Баланс сах./Мцлкиййятчи':
        'Сумгайыт шящяр Иъра Щакимиййяти, Мянзил Коммунал Тясяррцфаты',
      'Цмуми сащя': '17.3',
      'Ясас сащя': '17.3',
      'Йардымчы сащя': '0',
      'Торпаг сащяси': '0',
      'Паспорт нюмряси': '2257',
      'Тяртиб едилмя тарихи': '08.01.2007',
      'Инвентар нюмряси': '16609',
      'Тикилиалты сащя': '0',
    },
  ],
};

const FIXTURES = [
  ['EMDK-FERİD_Smtn_updated (5).xlsx', 'emdk.xlsx', EMDK_ROWS],
  ['Hövsan s-s Smtn.xlsx', 'hovsan.xlsx', HOVSAN_ROWS],
  ['QEYRI-YAS.-SBTİ.xlsx', 'qeyri-yasayis-sbti.xlsx', QEYRI_ROWS],
  [
    'Qeyri-yaşayış və SBTİ tex pasportlar Smtn.xlsx',
    'tex-pasportlar.xlsx',
    TEXPASPORT_ROWS,
  ],
  ['TORPAQ KOMİTESİ 03.06.2020 Smtn.xlsx', 'torpaq-komitesi.xlsx', TORPAQ_ROWS],
  ['пасбаза 2  Smtn.xlsx', 'pasbaza.xlsx', PASBAZA_ROWS],
];

/**
 * A header as these records name it. The office typed one of them across two
 * lines, and a line break inside a header is not a different column — the
 * lexicon folds every non-letter out of a header for the same reason.
 */
function norm(header) {
  return header.replaceAll(/\s+/gu, ' ').trim();
}

/** What a cell says, the way the reader reads one. */
function textOf(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') {
    if (value.richText) return value.richText.map(part => part.text).join('');
    if (value.result !== undefined) return textOf(value.result);
    if (value.text !== undefined) return String(value.text);
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return '';
  }

  return String(value);
}

async function build(source, target, rowsBySheet) {
  const read = new ExcelJS.Workbook();

  await read.xlsx.readFile(path.join(SOURCES, source));

  const written = new ExcelJS.Workbook();
  let records = 0;

  read.eachSheet(sheet => {
    const out = written.addWorksheet(sheet.name);
    const width = sheet.columnCount;
    let headers = null;

    for (let number = 1; number <= sheet.rowCount; number++) {
      const row = sheet.getRow(number);
      const cells = Array.from({ length: width }, (_, at) =>
        textOf(row.getCell(at + 1).value).trim(),
      );
      const first = cells[0] ?? '';

      // The sheet's own documentation, carried over exactly — except the
      // example row, which is an illustration and in one sheet is not even
      // aligned with the headers above it.
      if (!LABEL.test(first)) continue;
      if (/^example row/i.test(first)) continue;

      out.addRow(cells);
      if (HEADER_LABEL.test(first) && !headers) headers = cells;
    }

    const rows = rowsBySheet[sheet.name] ?? [];

    if (rows.length === 0) return;

    if (!headers) {
      throw new Error(
        `"${source}" sheet "${sheet.name}" has no header row to place records against.`,
      );
    }

    for (const record of rows) {
      for (const named of Object.keys(record)) {
        if (!headers.some(header => norm(header) === norm(named))) {
          throw new Error(
            `"${source}" sheet "${sheet.name}" has no column "${named}". ` +
              `It heads: ${headers.filter(one => one !== '').map(norm).join(', ')}.`,
          );
        }
      }

      // Column A stays blank: it is the label column, and a record is not a
      // label. Everything else goes under the header that names it.
      const at = new Map(Object.entries(record).map(([named, value]) => [norm(named), value])); // prettier-ignore

      out.addRow(headers.map((header, column) => (column === 0 ? '' : at.get(norm(header)) ?? ''))); // prettier-ignore
      records++;
    }
  });

  const file = path.join(OUT, target);

  await written.xlsx.writeFile(file);

  return { file, records };
}

fs.mkdirSync(OUT, { recursive: true });

for (const [source, target, rows] of FIXTURES) {
  const { file, records } = await build(source, target, rows);

  process.stdout.write(`${path.relative(process.cwd(), file)} — ${records} records\n`); // prettier-ignore
}
