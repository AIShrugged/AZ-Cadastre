/**
 * One row of one of the archive's own registers, placed into the register's
 * models.
 *
 * The catalogue says whose numbering a row's register number belongs to and
 * what kind of paper the row records; the lexicon says what each column means.
 * This is the assembly of the two — which model each value lands in, and which
 * rows a sheet cannot be read into at all (ADR-0012 §2).
 *
 * It is deliberately not in `domain/`. What a register is and what its columns
 * mean is knowledge about the archive; building an `ObjectImport` out of it is
 * this use case's own shape, and putting it below would be a domain layer that
 * knows the transport it is written for.
 */
import {
  fieldOfColumn,
  kindOfHolder,
  paperOf,
  type ArchiveRegister,
  type NativeField,
  type PaperKind,
  type SheetRow,
  type SheetTable,
} from '../domain/index.js';

import type {
  AddressImport,
  AliasImport,
  AliasRow,
  DocumentImport,
  ImportProblem,
  LocationImport,
  ObjectImport,
  ObjectRow,
  RightHolderImport,
} from './registry-import.schema.js';

export type NativeSheetResult = {
  readonly objects: readonly ObjectImport[];
  readonly problems: readonly ImportProblem[];
  /** Rows the sheet carried, whether or not an object came out of them. */
  readonly read: number;
  /** Columns the lexicon could name, out of the columns the sheet heads at all. */
  readonly columns: { readonly named: number; readonly read: number };
  /**
   * True where the sheet is not a register of records at all — a README, a
   * colour key, a clerk's tally. Reported once against the sheet rather than
   * row by row: a sheet the lexicon can name nothing in is one thing wrong and
   * not four hundred.
   */
  readonly skipped: boolean;
};

/**
 * The identifiers a row can be keyed by when the register carries no register
 * number of its own, in the order the archive would reach for them.
 *
 * Most of these registers have no `reyestr nömrəsi` column: they predate it.
 * What they do have is the number of the paper the row is about, and a
 * privatisation certificate number is a key an inspector can actually look
 * something up by — which an invented one would not be.
 */
const FALLBACK_KEYS: readonly NativeField[] = [
  'certificateNo',
  'contractNo',
  'stateActNo',
  'technicalPassportNo',
  'registerCode',
  'inventoryNo',
  'registrationNo',
  'applicationNo',
];

type AliasKind = AliasRow['kind'];

/** Which alias kind each identifier column is recorded as. */
const ALIAS_KINDS: readonly (readonly [NativeField, AliasKind])[] = [
  ['certificateNo', 'Certificate'],
  ['stateActNo', 'StateAct'],
  ['technicalPassportNo', 'TechnicalPassport'],
  ['inventoryNo', 'Inventory'],
  ['registerCode', 'RegisterCode'],
  ['registrationNo', 'Registration'],
  ['applicationNo', 'Application'],
];

export function objectsFromSheet(
  register: ArchiveRegister,
  table: SheetTable,
): NativeSheetResult {
  const columns = columnsOf(table);
  const sourceDatabase = `${register.id}:${table.name}`;
  const paper = paperOf(register, table.name);
  // No row of a register the catalogue recognises is refused. What a source
  // register carries is what it carries: a row with no number of its own is
  // keyed by its place in its own book, and a column nobody has seen is left
  // unread rather than reported at the operator, who did not write the file
  // and cannot fix it (ADR-0012 §4).
  const problems: ImportProblem[] = [];
  // Keyed rather than listed: these registers repeat a case across sheets — a
  // working copy beside the final one — and refusing the second sighting would
  // refuse the file. Two rows about one object are merged, and every child row
  // is written once (`registry_documents` is unique on the object and the
  // paper's name, so a second copy is a failure and not a duplicate).
  const built = new Map<string, Built>();
  // A sheet whose only readable column is its row number is not a register of
  // records. Every one of these files carries one — a README, a colour key, a
  // note about group headings — and reading it would key an object per row of
  // somebody's prose.
  const readable = [...columns.keys()].some(field => field !== 'rowNo');

  if (!readable) {
    return {
      objects: [],
      problems: [],
      read: table.rows.length,
      columns: { named: namedColumns(table), read: columns.size },
      skipped: true,
    };
  }

  for (const row of table.rows) {
    const value = (field: NativeField): string =>
      (row.values[columns.get(field) ?? -1] ?? '').trim();

    const keys = keysOf(register, table, row, value);

    for (const key of keys) {
      const at = keyOf(key.office, key.registerNo);
      const held = built.get(at) ?? blank();

      merge(held, key, keys, value, {
        register,
        sheet: table.name,
        paper,
        sourceDatabase,
      });
      built.set(at, held);
    }
  }

  return {
    objects: [...built.values()].map(collect),
    problems,
    read: table.rows.length,
    columns: { named: namedColumns(table), read: columns.size },
    skipped: false,
  };
}

/** Which column of the sheet carries which field. The first column to claim a field keeps it. */
function columnsOf(table: SheetTable): ReadonlyMap<NativeField, number> {
  const columns = new Map<NativeField, number>();

  for (let index = 0; index < widthOf(table); index++) {
    const field = fieldOfColumn(table.headers.map(row => row[index] ?? ''));

    if (field && !columns.has(field)) columns.set(field, index);
  }

  return columns;
}

function widthOf(table: SheetTable): number {
  return table.headers.reduce((most, row) => Math.max(most, row.length), 0);
}

function namedColumns(table: SheetTable): number {
  let named = 0;

  for (let index = 0; index < widthOf(table); index++) {
    if (table.headers.some(row => (row[index] ?? '').trim() !== '')) named++;
  }

  return named;
}

type ObjectKeyValue = {
  readonly office: string;
  readonly registerNo: string;
  /** The registration number issued with it at that office, where the sheet has one. */
  readonly registrationNo: string;
};

/** What one row is being read against, so the mapping does not take seven arguments. */
type Reading = {
  readonly register: ArchiveRegister;
  readonly sheet: string;
  readonly paper: PaperKind;
  readonly sourceDatabase: string;
};

/**
 * Every object this row is about.
 *
 * Usually one. The Hövsan handover registers put two on a row — the Absheron
 * office's pair and the Baku office's — and that is two objects and not a
 * choice between two columns: the case exists at both offices under different
 * numbers, and an inspector asking why the owner of record changed is asking
 * for exactly that pair (ADR-0010).
 */
function keysOf(
  register: ArchiveRegister,
  table: SheetTable,
  row: SheetRow,
  value: (field: NativeField) => string,
): readonly ObjectKeyValue[] {
  const keys: ObjectKeyValue[] = [];
  // A register whose rows belong to several offices names the office on the
  // row. The technical passport database numbers its passports from 1 within
  // each region, so the region is not decoration on that key — it is half of it.
  const office = register.officeFrom
    ? value(register.officeFrom) || register.office
    : register.office;

  for (const source of register.keys) {
    const registerNo = value(source.registerNo);

    if (registerNo === '') continue;

    keys.push({
      office: source.office,
      registerNo,
      registrationNo: source.registrationNo ? value(source.registrationNo) : '',
    });
  }

  if (keys.length > 0) return keys;

  for (const field of FALLBACK_KEYS) {
    const registerNo = value(field);

    if (registerNo === '') continue;

    return [{ office, registerNo, registrationNo: '' }];
  }

  // The technical passport register has no key of any kind: four columns, a row
  // number among them. Its own row number in its own book is what the archive
  // finds the entry by, so that is what the object is keyed by — written as the
  // sheet and the row, so that nobody mistakes it for a register number.
  const rowNo = value('rowNo') || String(row.number);

  return [
    {
      office,
      registerNo: `${table.name.trim()} #${rowNo}`,
      registrationNo: '',
    },
  ];
}

/** What is being built for one object key, before the duplicates are taken out. */
type Built = {
  object: ObjectRow | null;
  readonly addresses: AddressImport[];
  readonly rightHolders: RightHolderImport[];
  readonly documents: DocumentImport[];
  readonly aliases: AliasImport[];
  location: LocationImport | null;
};

function blank(): Built {
  return {
    object: null,
    addresses: [],
    rightHolders: [],
    documents: [],
    aliases: [],
    location: null,
  };
}

function merge(
  held: Built,
  key: ObjectKeyValue,
  keys: readonly ObjectKeyValue[],
  value: (field: NativeField) => string,
  reading: Reading,
): void {
  const text = (field: NativeField): string | null => value(field) || null;
  const held0 = held.object;

  held.object = {
    registerNo: key.registerNo,
    territorialOffice: key.office,
    inventoryNo: held0?.inventoryNo ?? text('inventoryNo'),
    cadastralNumber: held0?.cadastralNumber ?? text('cadastralNumber'),
    // The object's name where the register keeps no type column: these files
    // write "1 saylı avtomağazası" and "qeyri-yaşayış sahəsi" in the same
    // column, and the second is a type. Neither is translated on the way in.
    propertyType:
      held0?.propertyType ?? text('propertyType') ?? text('objectName'),
    district: held0?.district ?? text('district'),
    // The land plot and what is built on it are separate columns in these
    // registers and separate columns in the model. Neither is converted: the
    // same parcel is hectares on one paper and square metres on the next, and
    // both are what their paper says (`registry-object.prisma`).
    plotArea: held0?.plotArea ?? text('plotArea') ?? text('landArea'),
    totalArea: held0?.totalArea ?? text('totalArea'),
    mainArea: held0?.mainArea ?? text('mainArea'),
    auxiliaryArea: held0?.auxiliaryArea ?? text('auxiliaryArea'),
    footprintArea: held0?.footprintArea ?? text('footprintArea'),
    floors: held0?.floors ?? text('floors'),
    buildYear: held0?.buildYear ?? yearOf(value('buildYear')),
    ownershipType: held0?.ownershipType ?? text('ownershipType'),
    rightType: held0?.rightType ?? null,
    landOwnershipType: held0?.landOwnershipType ?? null,
    landRightType: held0?.landRightType ?? null,
    landCategory: held0?.landCategory ?? null,
    registryBookNo: held0?.registryBookNo ?? null,
    registryBookSheet: held0?.registryBookSheet ?? null,
    sourceDatabase: held0?.sourceDatabase ?? reading.sourceDatabase,
  };

  for (const address of addressesOf(value, reading.sourceDatabase)) {
    push(held.addresses, address, one => `${one.kind} ${one.value}`);
  }

  for (const holder of holdersOf(value, key)) {
    push(held.rightHolders, holder, one => one.name);
  }

  const location = locationOf(value, reading.sourceDatabase);
  const number = value(reading.paper.numberFrom);
  const issuedOn = reading.paper.issuedOnFrom
    ? value(reading.paper.issuedOnFrom)
    : '';

  push(
    held.documents,
    {
      name: reading.paper.name,
      holding: 'Held',
      taxonomyRef: reading.paper.taxonomyRef ?? null,
      // As written, and never split. The privatisation registers fuse a
      // certificate number with its date in one cell — "08812     12.01.1998".
      number: number || null,
      issuedOn: issuedOn || text('issuedOn'),
      issuingAuthority: reading.register.office,
      folder: location?.folder ?? null,
      pages: location?.pages ?? null,
      sourceDatabase: reading.sourceDatabase,
    },
    // One answer per kind of paper per object: `registry_documents` is unique on
    // it, so a second copy off a repeated sheet is a failure and not a duplicate.
    one => one.name,
  );

  for (const alias of aliasesOf(value, key, keys, reading.sourceDatabase)) {
    const identity = (one: AliasImport): string =>
      `${one.kind} ${one.value} ${one.issuingOffice ?? ''}`;

    push(held.aliases, alias, identity);
  }

  held.location ??= location;
}

/**
 * `Tikildiyi il`, the only value in any of these registers that is arithmetic
 * and the only one read as a number.
 *
 * Four digits and nothing else. The sources write "1984-cü il" and "təxminən
 * 1980" in this column, and the passport database writes `0` where nobody
 * recorded one — a year the import guessed at would be a figure no paper states
 * (ADR-0011 §3).
 */
function yearOf(written: string): number | null {
  return /^\d{4}$/.test(written) ? Number(written) : null;
}

function addressesOf(
  value: (field: NativeField) => string,
  sourceDatabase: string,
): readonly AddressImport[] {
  const written = value('address');
  const district = value('district');
  const addresses: AddressImport[] = [];

  // `Register`, never `Current`: this is how one of the archive's own registers
  // spells it, and the form the state register assigns is a different claim
  // that only a register extract carries (`registry-address.prisma`).
  if (written !== '') {
    addresses.push({ kind: 'Register', value: written, sourceDatabase });
  }

  // These registers keep the district in its own column, so the address cell
  // alone is "Y.Səfərov-1" and answers to no lookup. The two read together are
  // the spelling somebody would actually search by, and it is stored as a
  // second spelling rather than instead of the first: what the cell says is the
  // evidence, and what it means read with its column is a reading.
  if (written !== '' && district !== '' && !written.includes(district)) {
    addresses.push({
      kind: 'Register',
      value: `${district}, ${written}`,
      sourceDatabase,
    });
  }

  const second = value('secondAddress');

  if (second !== '') {
    addresses.push({ kind: 'Register', value: second, sourceDatabase });
  }

  return addresses;
}

function holdersOf(
  value: (field: NativeField) => string,
  key: ObjectKeyValue,
): readonly RightHolderImport[] {
  const holders: RightHolderImport[] = [];
  const name = value('holderName');
  const previous = value('previousOwner');

  if (name !== '') {
    holders.push({
      name,
      kind: kindOfHolder(name),
      share: null,
      registrationNo: key.registrationNo || value('registrationNo') || null,
      registeredOn: value('handoverDate') || null,
      previousOwner: previous || null,
      taxOrDocumentNo: null,
    });
  }

  // `Yeni Hüquq sahibləri` — who the case was re-registered to at the receiving
  // office. Kept beside the first and not instead of it: the column the 2008
  // transfer of cases between the two offices rewrote is exactly what an
  // inspector asking why the owner of record changed is looking for.
  const renewed = value('newHolderName');

  if (renewed !== '') {
    holders.push({
      name: renewed,
      kind: kindOfHolder(renewed),
      share: null,
      registrationNo: null,
      registeredOn: value('handoverDate') || null,
      previousOwner: name || previous || null,
      taxOrDocumentNo: null,
    });
  }

  return holders;
}

function aliasesOf(
  value: (field: NativeField) => string,
  key: ObjectKeyValue,
  keys: readonly ObjectKeyValue[],
  sourceDatabase: string,
): readonly AliasImport[] {
  const aliases: AliasImport[] = [];

  for (const [field, kind] of ALIAS_KINDS) {
    const written = value(field);

    if (written === '') continue;

    // The register code is meaningless without its sub-unit code — 00212851 is
    // the property and 000 is the part of it — so the two are stored as the one
    // identifier the sale-contract registers use them as.
    const sub = field === 'registerCode' ? value('subUnitCode') : '';

    aliases.push({
      kind,
      value: sub === '' ? written : `${written}-${sub}`,
      issuingOffice: key.office,
      sourceDatabase,
    });
  }

  if (key.registrationNo !== '') {
    aliases.push({
      kind: 'Registration',
      value: key.registrationNo,
      issuingOffice: key.office,
      sourceDatabase,
    });
  }

  // The other office's registration number. This is the value of a handover
  // register: an object that holds the Absheron office's number as well as its
  // own, each said to be that office's, so that four numbers across two records
  // are a story instead of four numbers.
  //
  // The other office's *register* number is deliberately not aliased. There is
  // no alias kind for it and there should not be: it is the key of the second
  // object this same row produced, and `AliasKind` names the numbers an object
  // answers to besides its key. What joins the two records is the inventory
  // number both carry, which is how the seed joins them too.
  for (const other of keys) {
    const same =
      other.office === key.office && other.registerNo === key.registerNo;

    if (same || other.registrationNo === '') continue;

    aliases.push({
      kind: 'Registration',
      value: other.registrationNo,
      issuingOffice: other.office,
      sourceDatabase,
    });
  }

  return aliases;
}

function locationOf(
  value: (field: NativeField) => string,
  sourceDatabase: string,
): LocationImport | null {
  const folder = value('folder');
  const from = value('pageFrom');
  const to = value('pageTo');
  // Kept whole and in the register's own wording, because half the sources
  // write it as one cell: "01-dən 30", "92-129", "06-DƏK səh. 48".
  const written = value('pages');
  const pages = written || [from, to].filter(part => part !== '').join(', ');

  if (folder === '' || pages === '') return null;

  return {
    folder,
    pages,
    bookNo: null,
    sheetNo: null,
    fundReference: null,
    sourceDatabase,
  };
}

function push<T>(into: T[], one: T, identity: (of: T) => string): void {
  if (!into.some(held => identity(held) === identity(one))) into.push(one);
}

function collect(held: Built): ObjectImport {
  return {
    // `merge` writes the object on every row it sees, so by here there is one.
    object: held.object as ObjectRow,
    addresses: held.addresses,
    rightHolders: held.rightHolders,
    documents: held.documents,
    aliases: held.aliases,
    location: held.location,
  };
}

function keyOf(office: string, registerNo: string): string {
  return JSON.stringify([office, registerNo]);
}
