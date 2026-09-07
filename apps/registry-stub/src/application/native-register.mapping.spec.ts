import { describe, expect, it } from 'vitest';

import {
  ABSHERON,
  BAKU_1,
  registerNamed,
  type ArchiveRegister,
  type SheetTable,
} from '../domain/index.js';

import { objectsFromSheet } from './native-register.mapping.js';

/** A documented sheet as `tableOf` hands one over: two header rows and records. */
function table(
  name: string,
  azerbaijani: readonly string[],
  english: readonly string[],
  rows: readonly (readonly string[])[],
): SheetTable {
  return {
    name,
    headers: [[...azerbaijani], [...english]],
    rows: rows.map((values, index) => ({
      number: index + 5,
      values: [...values],
      cells: {},
    })),
  };
}

function registerFor(id: string): ArchiveRegister {
  const register = registerNamed(id);

  if (!register) throw new Error(`no register "${id}" in the catalogue`);

  return register;
}

describe('reading a row of the ƏMDK privatisation registers', () => {
  const EMDK = registerFor('EMDK');
  const MULKUYAT = table(
    'Mulkuyat',
    ['Sıra №-si', 'Rayon', 'Şəhadətnamə verilir (Hüquqi şəxsin adı / Fiziki şəxsin S.A.A.)', 'Obyekt', 'Ünvan', 'Şəhadətnamə', 'Qovluq', 'Səhifə (başlanğıc)', 'Səhifə (son)', 'İlkin mülkiyyətçi', 'Qeydiyyat nömrəsi', 'Reyestr nömrəsi', 'Ünvan 2 (arxiv)'], // prettier-ignore
    ['Row No.', 'District', 'Certificate Issued To', 'Object', 'Address', 'Certificate', 'Folder', 'Page (from)', 'Page (to)', 'Original Owner', 'Registration Number', 'Register Number', 'Address 2 (Archive)'], // prettier-ignore
    [
      ['1', 'Suraxanı', 'Əliyeva Əsmər Sadıq qızı', 'Torpaq sahəsi', 'AZ 1112, Bakı şəhəri, Suraxanı rayonu, Bülbülə qəsəbəsi, Xankəndi küçəsi, giriş 23', '4a-303     11.02.2026', '112', '01-dən 24', 'DƏK', 'Həsənov Elşad Nizami oğlu', '1126037281', '006013025906', 'Bakı şəhəri, Suraxanı rayonu, Bülbülə qəsəbəsi'], // prettier-ignore
    ],
  );

  it('keys the object by the register number, under the register that holds it', () => {
    // act
    const [imported] = objectsFromSheet(EMDK, MULKUYAT).objects;

    // assert
    expect(imported?.object.registerNo).toBe('006013025906');
    expect(imported?.object.territorialOffice).toBe(EMDK.office);
    expect(imported?.object.sourceDatabase).toBe('EMDK:Mulkuyat');
  });

  /*
   * The number and the date fused into one cell, and the irregular spacing kept:
   * it is part of the value and not something to tidy on the way in
   * (`registry-document.prisma`).
   */
  it('records the paper the sheet is a register of, as written', () => {
    // act
    const [imported] = objectsFromSheet(EMDK, MULKUYAT).objects;

    // assert
    expect(imported?.documents).toEqual([
      expect.objectContaining({
        name: 'Şəhadətnamə',
        holding: 'Held',
        number: '4a-303     11.02.2026',
        folder: '112',
        pages: '01-dən 24, DƏK',
      }),
    ]);
  });

  it('keeps every spelling of the address the row carries', () => {
    // act
    const [imported] = objectsFromSheet(EMDK, MULKUYAT).objects;

    // assert
    expect(imported?.addresses.map(one => one.value)).toEqual([
      'AZ 1112, Bakı şəhəri, Suraxanı rayonu, Bülbülə qəsəbəsi, Xankəndi küçəsi, giriş 23',
      'Bakı şəhəri, Suraxanı rayonu, Bülbülə qəsəbəsi',
    ]);
    expect(imported?.addresses.every(one => one.kind === 'Register')).toBe(
      true,
    );
  });

  /*
   * These registers keep the district in its own column, so the address cell
   * alone is `Y.Səfərov-1` and answers to no lookup. Both are stored: what the
   * cell says is the evidence, and what it means read with its column is a
   * reading.
   */
  it('adds the district to the address where the cell does not carry it', () => {
    // arrange
    const auction = table(
      'Baki-auksion',
      ['Sıra №-si', 'Rayon', 'Obyektin adı', 'Fiziki şəxsin adı', 'Ünvanı', 'Şəhadətnamə', 'Qovluq', 'Səhifə'], // prettier-ignore
      ['Row No.', 'District', 'Name of the Object', 'Name of the Individual', 'Address', 'Certificate', 'Folder', 'Page'], // prettier-ignore
      [['1', 'Xətai', '1 saylı avtomağazası', 'Həsənova Fatma Əsgər qızı', 'Y.Səfərov-1', '08812     12.01.1998', '19', '92-129']], // prettier-ignore
    );

    // act
    const [imported] = objectsFromSheet(EMDK, auction).objects;

    // assert
    expect(imported?.addresses.map(one => one.value)).toEqual([
      'Y.Səfərov-1',
      'Xətai, Y.Səfərov-1',
    ]);
  });

  /*
   * Most of these registers predate the register number. The number of the paper
   * the row is about is a key an inspector can look something up by, which an
   * invented one would not be.
   */
  it('keys a row with no register number by the certificate it records', () => {
    // arrange
    const auction = table(
      'Baki-auksion',
      ['Sıra №-si', 'Rayon', 'Ünvanı', 'Şəhadətnamə'],
      ['Row No.', 'District', 'Address', 'Certificate'],
      [['1', 'Xətai', 'Y.Səfərov-1', '08812     12.01.1998']],
    );

    // act
    const [imported] = objectsFromSheet(EMDK, auction).objects;

    // assert
    expect(imported?.object.registerNo).toBe('08812     12.01.1998');
  });

  // `emdk` is a register of sale contracts and `Baki-auksion` one of
  // certificates, and the register's own word for the paper is what is stored.
  it('records a contract where the sheet is a register of contracts', () => {
    // arrange
    const contracts = table(
      'emdk',
      ['Sıra №-si', 'Rayon', 'Ünvanı', 'Müqavilənin nömrəsi'],
      ['Row No.', 'District', 'Address', 'Contract Number'],
      [['1', 'Səbail', '20-ci sahə dairəsi', 'm.2063, 02.09.2009']],
    );

    // act
    const [imported] = objectsFromSheet(EMDK, contracts).objects;

    // assert
    expect(imported?.documents[0]?.name).toBe('Müqavilə');
  });
});

describe('reading a row of the Hövsan handover registers', () => {
  const HOVSAN = registerFor('Hovsan');
  const RECEIVED = table(
    'qəbul edilən',
    ['Sıra №-si', 'İnventar №', 'Abşeron Ə.İ üzrə qeydiyyat nömrəsi', 'AbşeronƏ.İ reyestr nömrəsi', 'Hüquq sahibi (-ləri)', 'Ünvan', 'Qeyd', 'Bakı Əİ üzrə qeydiyyat nömrəsi', 'Bakı Əİ üzrə reyestr nömrəsi', 'Yeni Hüquq sahibləri'], // prettier-ignore
    ['Row No.', 'Inventory No.', 'Registration Number with the Absheron Territorial Office', 'Absheron Territorial Office Registry Number', 'Right holder(s)', 'Adress', 'Note', 'Baku Territorial Office Registration Number', 'Baku Territorial Office Regisrty number', 'New Right Holders'], // prettier-ignore
    [
      ['1', '2088', '1608002040', '308011000714', 'Yusubova Gülmira Ramis qızı', 'Bakı şəhəri, Xəzər rayonu, Hövsan qəsəbəsi, sahə 12', 'birləşdirilib', '1119038649', '006011006721', 'Yusubov Ramin Elşad oğlu'], // prettier-ignore
    ],
  );

  /*
   * The case genuinely exists at both offices under different numbers — it was
   * entered again at the receiving office in 2008 and the old entry was never
   * closed — so this is two records and not a choice between two columns
   * (ADR-0010).
   */
  it('makes one object per office the row carries a register number for', () => {
    // act
    const { objects } = objectsFromSheet(HOVSAN, RECEIVED);

    // assert
    expect(
      objects.map(one => [one.object.territorialOffice, one.object.registerNo]),
    ).toEqual([
      [ABSHERON, '308011000714'],
      [BAKU_1, '006011006721'],
    ]);
  });

  it('gives each object the registration number of both offices, each said to be theirs', () => {
    // act
    const [absheron] = objectsFromSheet(HOVSAN, RECEIVED).objects;

    // assert
    expect(absheron?.aliases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'Registration',
          value: '1608002040',
          issuingOffice: ABSHERON,
        }),
        expect.objectContaining({
          kind: 'Registration',
          value: '1119038649',
          issuingOffice: BAKU_1,
        }),
      ]),
    );
  });

  /*
   * `Yeni Hüquq sahibləri` against `Hüquq sahibi (-ləri)`: the receiving office
   * recorded a different holder, and the column the transfer rewrote is exactly
   * what an inspector asking why the owner of record changed is looking for.
   */
  it('keeps the holder the receiving office recorded beside the one before', () => {
    // act
    const [absheron] = objectsFromSheet(HOVSAN, RECEIVED).objects;

    // assert
    expect(
      absheron?.rightHolders.map(one => [one.name, one.previousOwner]),
    ).toEqual([
      // prettier-ignore
      ['Yusubova Gülmira Ramis qızı', null],
      ['Yusubov Ramin Elşad oğlu', 'Yusubova Gülmira Ramis qızı'],
    ]);
  });

  /*
   * The inventory number is on both records and is what joins them, which is how
   * the seed joins the pair it carries too.
   */
  it('carries the inventory number onto both records', () => {
    // act
    const { objects } = objectsFromSheet(HOVSAN, RECEIVED);

    // assert
    expect(objects.map(one => one.object.inventoryNo)).toEqual([
      '2088',
      '2088',
    ]);
  });
});

describe('reading a register with no key of its own', () => {
  const TEX = registerFor('TexPasport');

  /*
   * The technical passport register is four columns and none of them is a
   * number. Its own row in its own book is what the archive finds the entry by,
   * and it is written as the sheet and the row so that nobody mistakes it for a
   * register number.
   */
  it('keys a row by its place in the register book', () => {
    // arrange
    const passports = table(
      'List 1 ',
      ['Sıra №', 'Rayon', 'Ünvanı', 'Mülkiyyətin tam adı'],
      ['Row No.', 'District', 'Address', 'Full name of the property owner'],
      [['2', 'Nizami', 'Babək pr. Məhəllə 2269', '"Qərənfil 97" firması']],
    );

    // act
    const [imported] = objectsFromSheet(TEX, passports).objects;

    // assert
    expect(imported?.object.registerNo).toBe('List 1 #2');
    expect(imported?.rightHolders[0]?.kind).toBe('LegalEntity');
  });
});

describe('reading a sheet that is not a register of records', () => {
  /*
   * Every one of these files carries one — a README, a colour key, a note about
   * group headings. Reading it would key an object per row of somebody's prose.
   */
  it('skips a sheet the lexicon can name nothing in', () => {
    // arrange
    const notes = table(
      'Qeydlər',
      ['Sıra №-si', 'Kr', 'KOT', 'Ş'],
      ['Row No.', 'Kr', 'KOT', 'Ş'],
      [['1', 'b', '06', 'g']],
    );

    // act
    const result = objectsFromSheet(registerFor('EMDK'), notes);

    // assert
    expect(result.skipped).toBe(true);
    expect(result.objects).toEqual([]);
  });
});

describe('reading a register whose rows repeat across its sheets', () => {
  /*
   * `qəbul edilən` and `Sheet2` of the Hövsan file are the same register twice —
   * a working copy beside the final one. Refusing the second sighting would
   * refuse the file, and writing it twice would fail: `registry_documents` is
   * unique on the object and the paper's name.
   */
  it('writes one document for an object seen on two rows', () => {
    // arrange
    const twice = table(
      'qəbul edilən',
      ['Sıra №-si', 'AbşeronƏ.İ reyestr nömrəsi', 'Ünvan', 'Müraciət №'],
      ['Row No.', 'Absheron Territorial Office Registry Number', 'Adress', 'Application No.'], // prettier-ignore
      [
        ['1', '308011000714', 'Hövsan qəsəbəsi, sahə 12', '2132301546'],
        ['2', '308011000714', 'Hövsan qəsəbəsi, sahə 12', '2132301546'],
      ],
    );

    // act
    const { objects } = objectsFromSheet(registerFor('Hovsan'), twice);

    // assert
    expect(objects).toHaveLength(1);
    expect(objects[0]?.documents).toHaveLength(1);
    expect(objects[0]?.addresses).toHaveLength(1);
  });
});

describe('reading a row of the technical passport database', () => {
  const PASBAZA = registerFor('Pasbaza');

  function passports(
    region: string,
    passportNo: string,
    address: string,
  ): SheetTable {
    return table(
      'Лист4',
      ['Сыра №', 'Ил', 'Реэион', 'Обйектин ады', 'Цнван', 'Баланс сах./Мцлкиййятчи', 'Цмуми сащя', 'Ясас сащя', 'Йардымчы сащя', 'Торпаг сащяси', 'Паспорт нюмряси', 'Тяртиб едилмя тарихи', 'Инвентар нюмряси', 'Тикилиалты сащя', 'Тикилдийи ил', 'Мяртябяси'], // prettier-ignore
      ['Row No.', 'Year', 'Region', 'Name of the object', 'Address', 'Right owner', 'Total area', 'Main area', 'Auxiliary area', 'Land area', 'Passport number', 'Preparation date', 'Inventory number', 'footfrint area', 'Building date', 'Floor'], // prettier-ignore
      [['1', '2008', region, 'Гейри йашайыш сащяси', address, 'Язизов Ариф Мювлуд оьлу', '38.4', '38.4', '0', '1848.4', passportNo, '08.01.2008', '19093', '54.9', '1984', '2 (ики)']], // prettier-ignore
    );
  }

  /*
   * The passport database numbers its passports from 1 within each region, so
   * `Лист2` holds passport 2257 in Sumqayıt and `Лист4` holds passport 2257 in
   * Qusar — two buildings. A key that was the number alone would merge them.
   * This is ADR-0010's "unique per territorial office rather than globally"
   * arriving as a fact about the data rather than as a modelling choice.
   */
  it('keys a passport under the region that issued it', () => {
    // act
    const qusar = objectsFromSheet(
      PASBAZA,
      passports('Гусар', '2257', 'Гусар шящяри, Щ.З.Таьыйев кцчяси'),
    ).objects;
    const sumqayit = objectsFromSheet(
      PASBAZA,
      passports('Сумгайыт ш.', '2257', 'Сумгайыт шящяри, 21-ъи мящялля'),
    ).objects;

    // assert
    expect(qusar[0]?.object.territorialOffice).toBe('Гусар');
    expect(sumqayit[0]?.object.territorialOffice).toBe('Сумгайыт ш.');
    expect(qusar[0]?.object.registerNo).toBe('2257');
    expect(sumqayit[0]?.object.registerNo).toBe('2257');
  });

  // All five of them, each with the unit the source wrote it in and none of them
  // converted: the same parcel is hectares on one paper and square metres on the
  // next (`registry-object.prisma`).
  it('reads every area column the passport carries', () => {
    // act
    const [imported] = objectsFromSheet(
      PASBAZA,
      passports('Гусар', '2257', 'Гусар шящяри'),
    ).objects;

    // assert
    expect(imported?.object).toMatchObject({
      totalArea: '38.4',
      mainArea: '38.4',
      auxiliaryArea: '0',
      plotArea: '1848.4',
      footprintArea: '54.9',
      // Text, because the real value is "2 (ики)".
      floors: '2 (ики)',
    });
  });

  /*
   * The only column in any of these registers that is arithmetic, and the only
   * one read as a number. Four digits and nothing else: the passport database
   * writes `0` where nobody recorded a year, and a year the import guessed at
   * would be a figure no paper states (ADR-0011 §3).
   */
  it('reads a four-digit build year as a number and nothing else as one', () => {
    // arrange
    const unrecorded = table(
      'Лист4',
      ['Реэион', 'Цнван', 'Паспорт нюмряси', 'Тикилдийи ил'],
      ['Region', 'Address', 'Passport number', 'Building date'],
      [
        ['Гусар', 'Гусар шящяри', '1', '1984'],
        ['Гусар', 'Губа шящяри', '2', '0'],
      ],
    );

    // act
    const { objects } = objectsFromSheet(PASBAZA, unrecorded);

    // assert
    expect(objects.map(one => one.object.buildYear)).toEqual([1984, null]);
  });
});
