import { readFile } from 'node:fs/promises';
import path from 'node:path';

import ExcelJS from 'exceljs';
import { beforeAll, describe, expect, inject, it } from 'vitest';

import type { AddressLookupResponse } from '@cadastre/api-contracts/registry';
import type { ErrorBody } from '@cadastre/api-contracts/shared';

let baseUrl: string;
let template: Buffer;

const TEMPLATE = 'registry-import-template.xlsx';
const FIXTURES = path.join(import.meta.dirname, '..', 'fixtures');

/** One of the archive's own workbooks, built by `pnpm fixtures:archive`. */
function archive(name: string): Promise<Buffer> {
  return readFile(path.join(FIXTURES, 'archive', name));
}

beforeAll(async () => {
  baseUrl = inject('baseUrl');
  template = await readFile(path.join(FIXTURES, TEMPLATE));
});

type ImportReport = {
  accepted: boolean;
  source: {
    kind: 'Template' | 'ArchiveRegister';
    register: string | null;
    file: string | null;
    detectedBy: 'sheets' | 'fingerprint' | 'model';
    confidence: number | null;
    reason: string;
    sheets: { name: string; rows: number; columns: { named: number; read: number } }[]; // prettier-ignore
  };
  imported: number;
  refused: number;
  rows: Record<string, number>;
  problems: { sheet: string; row: number | null; column: string | null; message: string }[]; // prettier-ignore
  note: string;
};

async function upload(
  bytes: Buffer,
  filename = TEMPLATE,
): Promise<{ status: number; body: ImportReport & ErrorBody }> {
  const form = new FormData();

  form.append('file', new Blob([new Uint8Array(bytes)]), filename);

  const response = await fetch(`${baseUrl}/api/import/records`, {
    method: 'POST',
    body: form,
  });

  return { status: response.status, body: await response.json() };
}

/** A one-sheet workbook, for the files that are not register files at all. */
async function workbookOf(
  name: string,
  rows: readonly (readonly string[])[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(name);

  for (const row of rows) sheet.addRow([...row]);

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

async function lookup(address: string): Promise<AddressLookupResponse> {
  const response = await fetch(`${baseUrl}/api/addresses/lookup`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ address, attributes: [], documents: [] }),
  });

  return response.json() as Promise<AddressLookupResponse>;
}

describe('loading a workbook of register records', () => {
  /*
   * The template ships with the customer's two real cases and one row that is
   * invalid on purpose, so one upload exercises both paths. 200 and not 201: the
   * answer is a report on what the register now holds, not a resource created at
   * a URL.
   */
  it('stores the objects it can and refuses the one it cannot', async () => {
    // act
    const { status, body } = await upload(template);

    // assert
    expect(status).toBe(200);
    expect(body).toMatchObject({ accepted: false, imported: 2, refused: 1 });
  });

  it('says which sheet, row and column each refusal is at', async () => {
    // act
    const { body } = await upload(template);

    // assert — the third record of the template, on row 4 under its header
    expect(body.problems).toEqual([
      {
        sheet: 'Objects',
        row: 4,
        column: 'registerNo',
        message: 'must not be empty',
      },
      {
        sheet: 'Objects',
        row: 4,
        column: 'buildYear',
        message: 'must be a four-digit year',
      },
    ]);
  });

  it('counts the rows that hang off the objects it stored', async () => {
    // act
    const { body } = await upload(template);

    // assert
    expect(body.rows).toEqual({
      addresses: 8,
      rightHolders: 2,
      documents: 10,
      aliases: 4,
      locations: 2,
    });
  });

  /*
   * The template is the seed's own two cases, value for value, so loading it
   * into a seeded register leaves the register holding exactly what it held. A
   * lookup that stopped resolving would mean the import wrote something the seed
   * did not.
   */
  it('leaves the record the register already held answering as it did', async () => {
    // act
    await upload(template);
    const answer = await lookup(
      'Sabunçu r., Zabrat qəs., Qazı Məhəmmədov küç., giriş 95A',
    );

    // assert
    expect(answer.outcome).toBe('Found');
    expect(answer.record?.registerNo).toBe('005013055966-10301');
    expect(answer.record?.location).toEqual({
      folder: '246',
      pages: '01-dən 44',
    });
  });

  /*
   * Loading the same workbook twice is loading it once — the object is upserted
   * on its key and the rows hanging off it are replaced. An operator who is not
   * sure whether the first upload landed has to be able to repeat it.
   */
  it('is the same register after the same workbook twice', async () => {
    // act
    await upload(template);
    const { body } = await upload(template);
    const answer = await lookup(
      'Bakı şəhəri, Xəzər rayonu, Buzovna qəsəbəsi, sahə 5-862',
    );

    // assert — one record and not two, and the papers listed once each
    expect(body.imported).toBe(2);
    expect(answer.outcome).toBe('Found');
    expect(answer.record?.documents.map(document => document.name)).toEqual([
      'Ərizə',
      'Sərəncam çıxarışı',
      'Arayış',
      'Texniki Pasport',
      'Müayinə aktı',
    ]);
  });
});

describe('what the import refuses outright', () => {
  it('refuses a request that carries no file', async () => {
    // act
    const response = await fetch(`${baseUrl}/api/import/records`, {
      method: 'POST',
      body: new FormData(),
    });
    const body = (await response.json()) as ErrorBody;

    // assert — the contract's one error shape, not a second one
    expect(response.status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });

  // The extension and not the media type: the tools that produce these files
  // disagree about what an .xlsx is called.
  it('refuses a file that is not named as a workbook', async () => {
    // act
    const { status, body } = await upload(template, 'registers.csv');

    // assert
    expect(status).toBe(400);
    expect(body.message).toContain('registers.csv');
  });

  /*
   * A file that is not a workbook is an error; a workbook whose rows are wrong
   * is a report. The two are different answers because they are different
   * questions — the first cannot be fixed row by row.
   */
  it('refuses bytes that no spreadsheet could have written', async () => {
    // act
    const { status, body } = await upload(
      Buffer.from('reyestr nömrəsi;ünvan\n', 'utf8'),
    );

    // assert
    expect(status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
  });
});

/*
 * The other workbook. These are the files the archive actually stores — the
 * customer's own five, with records written under their own documentation by
 * `fixtures/build-archive-fixtures.mjs` — and the register recognises which of
 * them it is holding rather than being told (ADR-0012).
 */
describe("loading one of the archive's own registers", () => {
  it('recognises which register the workbook is, and says who decided', async () => {
    // act
    const { status, body } = await upload(await archive('emdk.xlsx'), 'emdk.xlsx'); // prettier-ignore

    // assert
    expect(status).toBe(200);
    expect(body.source).toMatchObject({
      kind: 'ArchiveRegister',
      register: 'EMDK',
      // The rule and not a model: `WORKBOOK_CLASSIFIER_PROVIDER` defaults to
      // `mock`, so the whole import path runs with no API key and no network.
      detectedBy: 'fingerprint',
    });
    expect(body.accepted).toBe(true);
    expect(body.imported).toBeGreaterThan(0);
  });

  /*
   * The case the end-to-end scenario runs: `INPUTS/AZkadastr.pdf`, a land plot
   * in Bülbülə. Nothing in the seed answers to that address, so before the
   * upload the register holds nothing about it and after the upload it holds a
   * record — which is the whole point of an import.
   */
  it('answers about a property it held nothing about before the upload', async () => {
    // arrange
    const address =
      'Bakı şəhəri, Suraxanı rayonu, Bülbülə qəsəbəsi, Xankəndi küçəsi, giriş 23';

    // act
    await upload(await archive('emdk.xlsx'), 'emdk.xlsx');
    const found = await lookup(address);

    // assert
    expect(found.outcome).toBe('Found');
    expect(found.record).toMatchObject({
      registerNo: '006013025906',
      ownerName: 'Əliyeva Əsmər Sadıq qızı',
      // The most useful thing the register has for an inspector, and the one
      // thing an application package never carries.
      location: { folder: '112', pages: '01-dən 24, DƏK' },
    });
  });

  // The register's own word for the paper, never the caller's document type:
  // the two vocabularies were written by different offices decades apart.
  it("says which paper it holds for that property, in the register's own words", async () => {
    // act
    await upload(await archive('emdk.xlsx'), 'emdk.xlsx');
    const found = await lookup(
      'Bakı şəhəri, Suraxanı rayonu, Bülbülə qəsəbəsi, Xankəndi küçəsi, giriş 23',
    );

    // assert
    expect(found.record?.documents).toEqual([
      expect.objectContaining({
        name: 'Şəhadətnamə',
        holding: 'Held',
        // As written: the number and its date fused into one cell, spacing and
        // all (ADR-0010 §2).
        number: '4a-303     11.02.2026',
      }),
    ]);
  });

  /*
   * Loading the same register file twice is loading it once. It matters more
   * here than for the template: an operator working through fifty-five files has
   * no way to know which of them they already did.
   */
  it('leaves the register holding what the file says and not the union of two attempts', async () => {
    // arrange
    const bytes = await archive('emdk.xlsx');

    // act
    const first = await upload(bytes, 'emdk.xlsx');
    const second = await upload(bytes, 'emdk.xlsx');

    // assert
    expect(second.body.imported).toBe(first.body.imported);
    expect(await lookup('Xarici dairəvi, 2061-ci məhəllə')).toMatchObject({
      outcome: 'Found',
      candidates: 1,
    });
  });

  /*
   * One row of a handover register is two records of one house, because the case
   * was entered again at the receiving office in 2008 and the old entry was
   * never closed. Both are real, and the register saying so is an answer and not
   * a failure (ADR-0010, ADR-0012 §5).
   */
  it('makes a handover row two records, and says the address is ambiguous', async () => {
    // act
    const { body } = await upload(await archive('hovsan.xlsx'), 'hovsan.xlsx');
    const found = await lookup(
      'Bakı şəhəri, Xəzər rayonu, Hövsan qəsəbəsi, Zeytun küçəsi, ev 12',
    );

    // assert — two rows in, four objects out
    expect(body.source.register).toBe('Hovsan');
    expect(body.imported).toBe(4);
    expect(found).toMatchObject({ outcome: 'Ambiguous', candidates: 2 });
  });

  /*
   * The register book of the former inventory office is still in the
   * Azerbaijani legacy Cyrillic code page — not Russian. A submission written in
   * Latin has to resolve to it, which is what the address rules' code-page table
   * is for, and it is what tells this file from every other one.
   */
  it('reads the register written in the legacy Cyrillic code page', async () => {
    // act
    const { body } = await upload(
      await archive('qeyri-yasayis-sbti.xlsx'),
      'qeyri-yasayis-sbti.xlsx',
    );

    // assert
    expect(body.source.register).toBe('QeyriYasayis');
    expect(body.imported).toBe(2);
  });

  /*
   * Four columns and none of them a number. Its own row in its own book is what
   * the archive finds the entry by, written out so nobody mistakes it for a
   * register number (ADR-0012 §4).
   */
  it('keys a register with no key of its own by its place in its own book', async () => {
    // act
    const { body } = await upload(
      await archive('tex-pasportlar.xlsx'),
      'tex-pasportlar.xlsx',
    );
    const found = await lookup('Nizami rayonu, Babək prospekti, məhəllə 2269');

    // assert
    expect(body.source.register).toBe('TexPasport');
    expect(found.record?.registerNo).toBe('List 1 #1');
  });

  /*
   * The Land Committee's sheets are indexes by holder and act number and carry
   * no address at all. An object the register holds and cannot find by address
   * is the shape of half the archive, and it goes in anyway.
   */
  it('stores a register that carries no address column', async () => {
    // act
    const { body } = await upload(
      await archive('torpaq-komitesi.xlsx'),
      'torpaq-komitesi.xlsx',
    );

    // assert
    expect(body).toMatchObject({
      accepted: true,
      imported: 3,
      rows: expect.objectContaining({ addresses: 0, documents: 3 }),
    });
  });

  /*
   * The sixth register, and the one that makes the object key what it is. It
   * numbers technical passports from 1 within each region, so its rows belong to
   * several offices and the region on the row is half the key — ADR-0010's
   * "unique per territorial office rather than globally" arriving as a fact
   * about the data. The seed already holds passport 2257 for Qusar; this file
   * carries passport 2257 for Sumqayıt, and they are two buildings.
   */
  it('keys the passport database by the region that issued the passport', async () => {
    // act
    const { body } = await upload(
      await archive('pasbaza.xlsx'),
      'pasbaza.xlsx',
    );
    const found = await lookup('Сумгайыт шящяри, 21-ъи мящялля, бина-2/11');

    // assert
    expect(body.source.register).toBe('Pasbaza');
    expect(body.imported).toBe(2);
    // Not the Qusar record the seed holds under the same number.
    expect(found).toMatchObject({ outcome: 'Found', candidates: 1 });
    expect(found.record?.registerNo).toBe('2257');
  });

  /*
   * Neither the register's own template nor a file the catalogue recognises.
   * That is not a row to report against — it is a file the register cannot read
   * at all, which is the one thing answered with an error rather than a report.
   */
  it('refuses a workbook that is neither the template nor an archive register', async () => {
    // arrange — a plausible spreadsheet that is none of them
    const invoices = await workbookOf('Invoices', [
      ['Invoice No.', 'Customer', 'Net', 'VAT', 'Gross'],
      ['2026-001', 'ACME', '100', '18', '118'],
    ]);

    // act
    const { status, body } = await upload(invoices, 'invoices.xlsx');

    // assert
    expect(status).toBe(400);
    expect(body.code).toBe('VALIDATION_FAILED');
    expect(body.message).toContain('archive registers');
  });
});
