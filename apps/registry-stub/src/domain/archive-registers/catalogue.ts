/**
 * The six archive registers the customer keeps, as the register knows them.
 *
 * Each entry is one workbook the archive actually stores — not a schema we
 * invented for it. What a catalogue entry says is the part a spreadsheet cannot:
 * whose numbering its register numbers belong to, what kind of paper a row of it
 * records, and which sheet names and column headers identify it when a file
 * arrives with no covering note. Everything else — what a column means — is the
 * lexicon's, because that question has the same answer in all six (ADR-0012).
 *
 * A sixth register is a sixth entry here and no new code.
 */
import { foldHeader, type NativeField } from './header-lexicon.js';

/** The offices whose numbering the register numbers of these files belong to. */
export const BAKU_1 = '1 saylı Bakı Ərazi İdarəsi';
export const ABSHERON = 'Abşeron Ərazi İdarəsi';
export const EMDK_ARCHIVE = 'Əmlak Məsələləri Dövlət Komitəsinin arxivi';
export const LAND_COMMITTEE = 'Dövlət Torpaq Komitəsi';
export const BTI = 'Sabiq Bakı Texniki İnventarlaşdırma İdarəsi';

export type ArchiveRegisterId =
  | 'EMDK'
  | 'Hovsan'
  | 'Pasbaza'
  | 'QeyriYasayis'
  | 'TexPasport'
  | 'TorpaqKomitesi';

/**
 * Where the key of an object read out of this register comes from.
 *
 * A source register that carries a register number is keyed by it, under the
 * office whose numbering it is. The Hövsan handover registers carry two of
 * them — one office each — and that is not a column to choose between: the case
 * genuinely exists at both offices under different numbers, so the row becomes
 * two objects, exactly as ADR-0010 says a transferred case does.
 */
export type ObjectKeySource = {
  readonly office: string;
  readonly registerNo: NativeField;
  /** The registration number issued alongside it, where the sheet carries one. */
  readonly registrationNo?: NativeField;
};

/** The kind of paper a row of a sheet records, in the register's own word for it. */
export type PaperKind = {
  /** `Şəhadətnamə`, `Dövlət aktı`, `Texniki Pasport` — never the caller's document type. */
  readonly name: string;
  /** Where the paper's number is written on the row. */
  readonly numberFrom: NativeField;
  /** Where its date is, when the sheet keeps it apart from the number. */
  readonly issuedOnFrom?: NativeField;
  /** Its reference in the taxonomy of grounds for registration, where it is one. */
  readonly taxonomyRef?: string;
};

export type ArchiveRegister = {
  readonly id: ArchiveRegisterId;
  /** The file as the archive names it, so a report says what an operator uploaded. */
  readonly file: string;
  /** One line, in English, for the report and for the model that has to recognise it. */
  readonly what: string;
  /**
   * The office a row belongs to when the sheet carries no office of its own.
   * Part of the object key, so it is a decision and not a label.
   */
  readonly office: string;
  /**
   * Where the office is written, for a register whose rows belong to several.
   *
   * The technical passport database is the case, and it is not a nicety: it
   * numbers passports from 1 within each region, so `Лист2` holds passport 2257
   * in Sumqayıt and `Лист4` holds passport 2257 in Qusar, and they are two
   * buildings. A key that was the number alone would merge them. This is
   * ADR-0010's "unique per territorial office rather than globally" arriving as
   * a fact about the data rather than as a modelling choice.
   */
  readonly officeFrom?: NativeField;
  /** The sheets this register is known to carry, folded, as its fingerprint. */
  readonly sheets: readonly string[];
  /**
   * Headers that only this register has. The fingerprint's second half: two of
   * these files carry a sheet called `Sheet1`, and the columns under it are what
   * tell them apart.
   */
  readonly markers: readonly string[];
  /** Where an object's key comes from, in order of preference. */
  readonly keys: readonly ObjectKeySource[];
  /** What a row of it records, by sheet where the register keeps more than one kind. */
  readonly paper: PaperKind;
  readonly paperBySheet?: Readonly<Record<string, PaperKind>>;
};

const CERTIFICATE: PaperKind = {
  name: 'Şəhadətnamə',
  numberFrom: 'certificateNo',
  issuedOnFrom: 'certificateDate',
  // A privatisation certificate is a named ground for registration under
  // Article 8 of the law on the state register of immovable property.
  taxonomyRef: '8.0.5',
};

const CONTRACT: PaperKind = {
  name: 'Müqavilə',
  numberFrom: 'contractNo',
  issuedOnFrom: 'contractDate',
  taxonomyRef: '8.0.1',
};

export const ARCHIVE_REGISTERS: readonly ArchiveRegister[] = [
  {
    id: 'EMDK',
    file: 'EMDK-FERİD_Smtn.xlsx',
    what:
      'The privatisation registers of the State Property Committee (ƏMDK): ' +
      'auction, land, joint-venture, investment and lease sheets, each a row ' +
      'per certificate or sale contract with the district, the object, who it ' +
      'was issued to, the address, and the archive folder and page range.',
    office: EMDK_ARCHIVE,
    sheets: [
      'Baki-auksion', 'Q.yas-icara', 'Dub-Sah-al-Baki', 'Torpaq',
      'Birge Mus.-BM', 'Investisiya-sahadatnama', 'Rayon-sah-alava',
      'Mulkuyat', 'Rayon-hamisi-auksion', 'ozel-ham', 'emdk', 'deideik',
      'auks-erazi-2006-2009', 'qaris-2006-2009', 'emdk2', 'mulk-2008-2009',
      'Icara-DEIEDK-EMDK', 'Icara-EMDK', 'torp-2008-2010', 'eidk',
      'registr-2as', '2-rub', '1-rub-as', '1-rub',
    ], // prettier-ignore
    markers: [
      'sehadetnameverilirhuquqisexsinadifizikisexsinsaa',
      'emlakinterkibiobyektinadi',
      'balanssaxlayicikecmisbalanssaxlayiciteskilatinadi',
      'hansiyolileozellesib',
      'emlakinregistrkodu',
      'tikintialtitorpaqsahesi',
    ],
    keys: [{ office: EMDK_ARCHIVE, registerNo: 'registerNo', registrationNo: 'registrationNo' }], // prettier-ignore
    paper: CERTIFICATE,
    paperBySheet: {
      emdk: CONTRACT,
      emdk2: CONTRACT,
      eidk: CONTRACT,
      'registr-2as': CONTRACT,
      '1-rub-as': CONTRACT,
      '1-rub': CONTRACT,
      '2-rub': CONTRACT,
    },
  },
  {
    id: 'Hovsan',
    file: 'Hövsan s-s Smtn.xlsx',
    what:
      'The Hövsan sovkhoz handover registers: the cases moved between the ' +
      'Absheron and the 1st Baku territorial offices, a row carrying both ' +
      "offices' registration and register numbers, the right holders before " +
      'and after, and the date the papers were handed over.',
    office: BAKU_1,
    sheets: ['Sheet1', 'qəbul edilən', 'təhvil verilən', 'Sheet-1', 'Sheet2', 'Sheet3'], // prettier-ignore
    markers: [
      'abseroneiuzreqeydiyyatnomresi',
      'abseroneireyestrnomresi',
      'abseroneiuzrereyestrnomresi',
      'bakieiuzrereyestrnomresi',
      'bakieiuzreqeydiyyatnomresi',
      'yenihuquqsahibleri',
      'tehvilverilmetarixi',
    ],
    // Two offices and therefore two objects, which is the whole point of the
    // handover registers: the same house is 308011000692 at Absheron and
    // 006011006603 at Baku, and an inspector asking why the owner of record
    // changed is asking for exactly that pair (ADR-0010).
    keys: [
      { office: ABSHERON, registerNo: 'absheronRegisterNo', registrationNo: 'absheronRegistrationNo' }, // prettier-ignore
      { office: BAKU_1, registerNo: 'bakuRegisterNo', registrationNo: 'bakuRegistrationNo' }, // prettier-ignore
      {
        office: BAKU_1,
        registerNo: 'registerNo',
        registrationNo: 'registrationNo',
      },
    ],
    paper: { name: 'Qeydiyyat sənədləri', numberFrom: 'applicationNo' },
  },
  {
    id: 'Pasbaza',
    file: 'пасбаза 2 Smtn.xlsx',
    what:
      'The technical passport database of the whole country, in the ' +
      'Azerbaijani Cyrillic code page: a row per passport with its year, its ' +
      'region, the object, the address, the owner or balance holder, the ' +
      'total, main, auxiliary, land and footprint areas, the storeys, the ' +
      'year built and the inventory number.',
    // Only where the region column is blank. Every row of it names its own.
    office: BTI,
    officeFrom: 'district',
    sheets: ['Лист1', 'Лист2', 'Лист3', 'Лист4', 'Лист5'],
    markers: [
      'паспортнюмряси',
      'инвентарнюмряси',
      'тикилиалтысащя',
      'баланссахмцлкиииятчи',
      'реэион',
      'ясассащя',
    ],
    keys: [],
    paper: {
      name: 'Texniki Pasport',
      numberFrom: 'technicalPassportNo',
      issuedOnFrom: 'issuedOn',
      taxonomyRef: '439:7',
    },
  },
  {
    id: 'QeyriYasayis',
    file: 'QEYRI-YAS.-SBTİ.xlsx',
    what:
      'The non-residential register book of the former Baku technical ' +
      'inventory office, still written in the Azerbaijani Cyrillic code page: ' +
      'a row per registry entry with its date, its registry number, the ' +
      'address, the right owner, and any note on removal from the book.',
    office: BTI,
    sheets: ['Sheet1'],
    // The code page alone is not the fingerprint — the technical passport
    // database is in it too — so these are the headers only the register book
    // heads, and no Latin spelling folds onto them.
    markers: ['цнван', 'мцлкиииятинтамады', 'реиестрnoси', 'тарих', 'реиестркитабынданчыхарылмащагдагеид'], // prettier-ignore
    keys: [{ office: BTI, registerNo: 'registerNo' }],
    paper: {
      name: 'Reyestr çıxarışı',
      numberFrom: 'registerNo',
      issuedOnFrom: 'issuedOn',
    },
  },
  {
    id: 'TexPasport',
    file: 'Qeyri-yaşayış və SBTİ tex pasportlar Smtn.xlsx',
    what:
      'The technical passports held for non-residential property: four ' +
      'columns and no key of its own — a row number, the district, the ' +
      'address and the full name of the owner.',
    office: BTI,
    sheets: ['List 1'],
    markers: ['mulkiyyetintamadi'],
    // No key at all. The row number is the register's own locator into its own
    // book, and it is what the object is keyed by, spelled so that nobody
    // mistakes it for a register number — see `keyOfRow`.
    keys: [],
    paper: {
      name: 'Texniki Pasport',
      numberFrom: 'technicalPassportNo',
      taxonomyRef: '439:7',
    },
  },
  {
    id: 'TorpaqKomitesi',
    file: 'TORPAQ KOMİTESİ 03.06.2020 Smtn.xlsx',
    what:
      'The Land Committee registers: state acts, lease agreements and ' +
      'cadastral plans, each sheet a row per act with the holder, the act ' +
      'number and a note.',
    office: LAND_COMMITTEE,
    sheets: ['DÖVLƏT AKTI', 'İcarə müqaviləsi', 'KADASTR PLANI BALACA', 'JN', 'KADASTR'], // prettier-ignore
    markers: ['nojn', 'stateactnumber', 'stateactno'],
    keys: [{ office: LAND_COMMITTEE, registerNo: 'stateActNo' }],
    paper: {
      name: 'Dövlət aktı',
      numberFrom: 'stateActNo',
      // A state act on land is a ground for registration under Decree 439 §2.3.
      taxonomyRef: '439:2.3',
    },
    paperBySheet: {
      'İcarə müqaviləsi': {
        name: 'İcarə müqaviləsi',
        numberFrom: 'stateActNo',
        taxonomyRef: '8.0.1',
      },
      'KADASTR PLANI BALACA': {
        name: 'Kadastr planı',
        numberFrom: 'stateActNo',
      },
      KADASTR: { name: 'Kadastr planı', numberFrom: 'stateActNo' },
    },
  },
];

const BY_ID: ReadonlyMap<string, ArchiveRegister> = new Map(
  ARCHIVE_REGISTERS.map(register => [register.id, register]),
);

export function registerNamed(id: string): ArchiveRegister | null {
  return BY_ID.get(id) ?? null;
}

/** What kind of paper a row of this sheet records. */
export function paperOf(register: ArchiveRegister, sheet: string): PaperKind {
  return register.paperBySheet?.[sheet.trim()] ?? register.paper;
}

/** A sheet name as the fingerprint compares them. */
export function foldSheet(name: string): string {
  return foldHeader(name);
}
