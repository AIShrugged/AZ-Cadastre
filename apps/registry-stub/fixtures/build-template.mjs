/**
 * Builds `registry-import-template.xlsx`, the workbook `POST /api/import/records`
 * takes.
 *
 * The template is committed because it is what an operator downloads, and it is
 * built by a script because a committed binary nobody can regenerate is a file
 * that quietly stops matching the schemas it is a template for. Run it with
 * `pnpm fixtures:template` after changing `registry-import.schema.ts`.
 *
 * Its two positive records are the customer's own cases, value for value off
 * `src/infrastructure/persistence/seed.ts` — Rusadze Vera Vladimirovna, which
 * confirms on every attribute and every paper, and Əliyeva Rübabə Kavı qızı,
 * whose figures do not add up. Loading the template into a seeded register
 * therefore changes nothing, which is the point: the import is idempotent and a
 * template that rewrote the register would be a poor way to show it.
 *
 * Its third record is deliberately invalid — no register number, and a build
 * year written the way the sources write it ("1984-cü il") rather than as a
 * year. It is there so that the validation path has something to answer, and the
 * report it produces names the sheet, the row and the column of each.
 */
import path from 'node:path';

import ExcelJS from 'exceljs';

const BAKU_1 = '1 saylı Bakı Ərazi İdarəsi';
const BAKU_ARCHIVE = 'Bakı Əİ arxivi';

const RUSADZE = '005013055966-10301';
const ALIYEVA = '003013067339-10301';

/** The column each sheet carries, in the order the template lays them out. */
const COLUMNS = {
  Objects: [
    'registerNo',
    'territorialOffice',
    'inventoryNo',
    'cadastralNumber',
    'propertyType',
    'district',
    'plotArea',
    'totalArea',
    'mainArea',
    'auxiliaryArea',
    'footprintArea',
    'floors',
    'buildYear',
    'ownershipType',
    'rightType',
    'landOwnershipType',
    'landRightType',
    'landCategory',
    'registryBookNo',
    'registryBookSheet',
    'sourceDatabase',
  ],
  Addresses: ['registerNo', 'territorialOffice', 'kind', 'value', 'sourceDatabase'], // prettier-ignore
  RightHolders: [
    'registerNo',
    'territorialOffice',
    'name',
    'kind',
    'share',
    'registrationNo',
    'registeredOn',
    'previousOwner',
    'taxOrDocumentNo',
  ],
  Documents: [
    'registerNo',
    'territorialOffice',
    'name',
    'holding',
    'taxonomyRef',
    'number',
    'issuedOn',
    'issuingAuthority',
    'folder',
    'pages',
    'sourceDatabase',
  ],
  Aliases: ['registerNo', 'territorialOffice', 'kind', 'value', 'issuingOffice', 'sourceDatabase'], // prettier-ignore
  Locations: [
    'registerNo',
    'territorialOffice',
    'folder',
    'pages',
    'bookNo',
    'sheetNo',
    'fundReference',
    'sourceDatabase',
  ],
};

const OBJECTS = [
  {
    registerNo: RUSADZE,
    territorialOffice: BAKU_1,
    propertyType: 'Fərdi yaşayış evi',
    district: 'Sabunçu rayonu',
    // Hectares here and square metres on the engineer's report of the same
    // house. Both are what their paper says; the matching rules convert.
    plotArea: '0.04 ha',
    totalArea: '162.9',
    floors: '1',
    ownershipType: 'Xüsusi',
    rightType: 'Mülkiyyət',
    landOwnershipType: 'Xüsusi',
    landRightType: 'Mülkiyyət',
    landCategory: 'Yaşayış məntəqələrinin torpaqları',
    registryBookNo: '805',
    registryBookSheet: '64',
    sourceDatabase: BAKU_ARCHIVE,
  },
  {
    registerNo: ALIYEVA,
    territorialOffice: BAKU_1,
    propertyType: 'Fərdi yaşayış evi',
    district: 'Xəzər rayonu',
    plotArea: '0.0309 ha',
    totalArea: '233.20',
    floors: '2',
    ownershipType: 'Xüsusi',
    rightType: 'Mülkiyyət',
    landOwnershipType: 'Xüsusi',
    landRightType: 'Mülkiyyət',
    landCategory: 'Yaşayış məntəqələrinin torpaqları',
    sourceDatabase: BAKU_ARCHIVE,
  },
  // The negative example. Two things are wrong with it and the report says both:
  // an object with no register number cannot be keyed at all, and a build year
  // the import guessed at would be a figure no paper states.
  {
    registerNo: '',
    territorialOffice: BAKU_1,
    propertyType: 'Fərdi yaşayış evi',
    district: 'Xəzər rayonu',
    plotArea: '0.05 ha',
    buildYear: '1984-cü il',
    sourceDatabase: BAKU_ARCHIVE,
  },
];

const ADDRESSES = [
  {
    registerNo: RUSADZE,
    territorialOffice: BAKU_1,
    kind: 'Current',
    value:
      'AZ 1104, Bakı şəhəri, Sabunçu rayonu, Zabrat qəsəbəsi, ' +
      'Qazı Məhəmmədov küçəsi, giriş 95A',
  },
  // `Köhnə ünvan`, printed in the same cell of the extract, under the new one.
  {
    registerNo: RUSADZE,
    territorialOffice: BAKU_1,
    kind: 'Legacy',
    value: 'Bakı Şəhəri, Sabunçu rayonu, Zabrat qəsəbəsi',
  },
  {
    registerNo: RUSADZE,
    territorialOffice: BAKU_1,
    kind: 'Register',
    value: 'Sabunçu ray, Zabrat qəs, Qazı Məhəmmədov küç, giriş 95A',
    sourceDatabase: BAKU_ARCHIVE,
  },
  // How the parcel is described on the papers of the submission itself, before
  // it had a street — which is what the register is actually asked about.
  {
    registerNo: RUSADZE,
    territorialOffice: BAKU_1,
    kind: 'Register',
    value:
      'Bakı şəhəri, Sabunçu rayonu, 1-ci Zabrat qəsəbəsindən yeni ' +
      'məhəlləyə gedən yolun solunda',
    sourceDatabase: BAKU_ARCHIVE,
  },
  {
    registerNo: RUSADZE,
    territorialOffice: BAKU_1,
    kind: 'Register',
    value: 'Zabrat-1 qəsəbəsi, Yeni məhəlləyə gedən yolun sol tərəfində',
    sourceDatabase: BAKU_ARCHIVE,
  },
  {
    registerNo: ALIYEVA,
    territorialOffice: BAKU_1,
    kind: 'Current',
    value:
      'AZ 1093, Bakı şəhəri, Xəzər rayonu, Buzovna qəsəbəsi, ' +
      '259-cu Buzovna küçəsi, giriş 14',
  },
  {
    registerNo: ALIYEVA,
    territorialOffice: BAKU_1,
    kind: 'Legacy',
    value: 'Bakı şəhəri, Xəzər rayonu, Buzovna qəsəbəsi, sahə 5-862',
  },
  {
    registerNo: ALIYEVA,
    territorialOffice: BAKU_1,
    kind: 'Register',
    value:
      'Bakı şəhəri, Xəzər rayonu, Buzovna qəsəbəsi, 5-862 saylı torpaq sahəsi',
    sourceDatabase: BAKU_ARCHIVE,
  },
];

const RIGHT_HOLDERS = [
  {
    registerNo: RUSADZE,
    territorialOffice: BAKU_1,
    name: 'Rusadze Vera Vladimirovna',
    kind: 'Individual',
    share: 'Tam',
    registrationNo: '1126027871',
    registeredOn: '08.05.2026',
  },
  {
    registerNo: ALIYEVA,
    territorialOffice: BAKU_1,
    name: 'Əliyeva Rübabə Kavı qızı',
    kind: 'Individual',
    share: 'Tam',
    registrationNo: '1126012493',
    registeredOn: '20.04.2026',
  },
];

const DOCUMENTS = [
  {
    registerNo: RUSADZE,
    territorialOffice: BAKU_1,
    name: 'Ərizə',
    holding: 'Held',
    number: '1126027871',
    issuedOn: '28.01.2026',
    issuingAuthority: BAKU_1,
  },
  {
    registerNo: RUSADZE,
    territorialOffice: BAKU_1,
    name: 'Sərəncam çıxarışı',
    holding: 'Held',
    taxonomyRef: '439:2.3',
    number: '396',
    issuedOn: '02.12.2021',
    issuingAuthority:
      'Bakı şəhəri Sabunçu rayonu İcra Hakimiyyəti başçısının sərəncamı',
  },
  {
    registerNo: RUSADZE,
    territorialOffice: BAKU_1,
    name: 'Arayış',
    holding: 'Held',
    number: '3-48-2F/2-R-134-8-470/2026',
    issuedOn: '23.01.2026',
    issuingAuthority: 'Azərbaycan Respublikası Dövlət Arxivinin Bakı Filialı',
  },
  {
    registerNo: RUSADZE,
    territorialOffice: BAKU_1,
    name: 'Texniki Pasport',
    holding: 'Held',
  },
  {
    registerNo: RUSADZE,
    territorialOffice: BAKU_1,
    name: 'Müayinə aktı',
    holding: 'Held',
  },
  {
    registerNo: ALIYEVA,
    territorialOffice: BAKU_1,
    name: 'Ərizə',
    holding: 'Held',
    number: '1126012493',
    issuedOn: '09.01.2026',
    issuingAuthority: BAKU_1,
  },
  {
    registerNo: ALIYEVA,
    territorialOffice: BAKU_1,
    name: 'Sərəncam çıxarışı',
    holding: 'Held',
    taxonomyRef: '439:2.3',
    number: '096',
    issuedOn: '15.04.1999',
    issuingAuthority: 'Abşeron Rayon İcra Hakimiyyəti',
  },
  {
    registerNo: ALIYEVA,
    territorialOffice: BAKU_1,
    name: 'Arayış',
    holding: 'Held',
    number: '1-2-28/2-496/2025',
    issuedOn: '15.12.2025',
    issuingAuthority:
      'Azərbaycan Respublikası Prezidentinin İşlər İdarəsi ' +
      'İctimai-Siyasi Sənədlər Arxivi',
  },
  {
    registerNo: ALIYEVA,
    territorialOffice: BAKU_1,
    name: 'Texniki Pasport',
    holding: 'Held',
  },
  {
    registerNo: ALIYEVA,
    territorialOffice: BAKU_1,
    name: 'Müayinə aktı',
    holding: 'Held',
  },
];

const ALIASES = [
  {
    registerNo: RUSADZE,
    territorialOffice: BAKU_1,
    kind: 'Application',
    value: '1126027871',
    issuingOffice: BAKU_1,
  },
  {
    registerNo: RUSADZE,
    territorialOffice: BAKU_1,
    kind: 'Registration',
    value: '1126027871',
    issuingOffice: BAKU_1,
  },
  {
    registerNo: ALIYEVA,
    territorialOffice: BAKU_1,
    kind: 'Application',
    value: '1126012493',
    issuingOffice: BAKU_1,
  },
  {
    registerNo: ALIYEVA,
    territorialOffice: BAKU_1,
    kind: 'Registration',
    value: '1126012493',
    issuingOffice: BAKU_1,
  },
];

const LOCATIONS = [
  {
    registerNo: RUSADZE,
    territorialOffice: BAKU_1,
    // A page range is not a number, which is why every one of these is text.
    folder: '246',
    pages: '01-dən 44',
    bookNo: '805',
    sheetNo: '64',
    fundReference: 'Fond-130, siy.1, i-476, var.98',
    sourceDatabase: BAKU_ARCHIVE,
  },
  {
    registerNo: ALIYEVA,
    territorialOffice: BAKU_1,
    folder: '138',
    pages: '92-129',
    fundReference: 'Ф.11165, оп.1, ед.хр.159',
    sourceDatabase: BAKU_ARCHIVE,
  },
];

const SHEETS = [
  ['Objects', OBJECTS],
  ['Addresses', ADDRESSES],
  ['RightHolders', RIGHT_HOLDERS],
  ['Documents', DOCUMENTS],
  ['Aliases', ALIASES],
  ['Locations', LOCATIONS],
];

/**
 * What the workbook is and how to fill it in, for whoever opens it.
 *
 * The import reads the six model sheets by name and ignores every other sheet,
 * so this one is free to be prose.
 */
const README = [
  ['Registry import template'],
  [],
  [
    'Upload this workbook to POST /api/import/records as multipart/form-data, field "file".',
  ],
  [],
  [
    'One sheet per model of the register. A row of Objects is one immovable-property object;',
    '',
  ],
  [
    'every other sheet hangs off it, joined by the two key columns registerNo and territorialOffice',
  ],
  [
    '— the key the register itself is scoped by, because a register number belongs to an office.',
  ],
  [],
  [
    'Every cell is text. Folder, page range, storey count and area with its unit are stored as',
  ],
  [
    'written: the sources hold "01-dan 30", "2 (iki)" and "0,05 ha" in those columns, and a number',
  ],
  ['would lose them. buildYear is the one exception and takes four digits.'],
  [],
  [
    'The order rows appear in is the order the register lists them in. Loading the same workbook',
  ],
  [
    'twice is loading it once: an object is upserted on its key and its rows are replaced.',
  ],
  [],
  [
    'An object with anything wrong in any of its rows is refused whole, and the report names the',
  ],
  [
    'sheet, row and column of each problem. The third row of Objects here is invalid on purpose.',
  ],
  [],
  ['Sheet', 'Model', 'Enumerated columns'],
  ['Objects', 'RegistryObject', ''],
  ['Addresses', 'RegistryAddress', 'kind: Current | Legacy | Register'],
  ['RightHolders', 'RegistryRightHolder', 'kind: Individual | LegalEntity'],
  ['Documents', 'RegistryDocument', 'holding: Held | NotHeld | Unknown'],
  [
    'Aliases',
    'RegistryAlias',
    'kind: Registration | Inventory | RegisterCode | StateAct | Certificate | TechnicalPassport | Application',
  ],
  ['Locations', 'ArchiveLocation', 'at most one row per object'],
];

async function build() {
  const workbook = new ExcelJS.Workbook();
  const readme = workbook.addWorksheet('README');

  for (const line of README) readme.addRow(line);
  readme.getRow(1).font = { bold: true };
  readme.getColumn(1).width = 100;

  for (const [name, rows] of SHEETS) {
    const sheet = workbook.addWorksheet(name);
    const columns = COLUMNS[name];

    sheet.addRow(columns);
    sheet.getRow(1).font = { bold: true };

    for (const row of rows) {
      // Written cell by cell rather than as an object so that a blank stays a
      // blank: an absent column and an empty one both mean "the source did not
      // carry this", and the import reads them the same way.
      sheet.addRow(columns.map(column => row[column] ?? ''));
    }

    for (const [index, column] of columns.entries()) {
      sheet.getColumn(index + 1).width = Math.max(column.length + 2, 18);
    }
  }

  const file = path.join(import.meta.dirname, 'registry-import-template.xlsx');

  await workbook.xlsx.writeFile(file);

  process.stdout.write(`Template written: ${file}\n`);
}

await build();
