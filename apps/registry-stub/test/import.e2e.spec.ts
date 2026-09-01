import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { beforeAll, describe, expect, inject, it } from 'vitest';

import type { AddressLookupResponse } from '@cadastre/api-contracts/registry';
import type { ErrorBody } from '@cadastre/api-contracts/shared';

let baseUrl: string;
let template: Buffer;

const TEMPLATE = 'registry-import-template.xlsx';

beforeAll(async () => {
  baseUrl = inject('baseUrl');
  template = await readFile(
    path.join(import.meta.dirname, '..', 'fixtures', TEMPLATE),
  );
});

type ImportReport = {
  accepted: boolean;
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
