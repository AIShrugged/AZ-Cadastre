import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { beforeAll, describe, expect, inject, it } from 'vitest';

import {
  RegistrySummaryResponseSchema,
  type RegistrySummaryResponse,
} from '@cadastre/api-contracts/registry';

let baseUrl: string;

const FIXTURES = path.join(import.meta.dirname, '..', 'fixtures');

/**
 * The six the catalogue carries. Every one of them is a line whether or not
 * anything was ever loaded from it — see `RegistrySummaryService`.
 */
const CATALOGUED = [
  'EMDK',
  'Hovsan',
  'Pasbaza',
  'QeyriYasayis',
  'TexPasport',
  'TorpaqKomitesi',
];

beforeAll(() => {
  baseUrl = inject('baseUrl');
});

async function summary(): Promise<{
  status: number;
  body: RegistrySummaryResponse;
}> {
  const response = await fetch(`${baseUrl}/api/registry/summary`);
  const body: unknown = await response.json();

  // Parsed by the published schema and not cast: what this set is for is the
  // shape on the wire.
  return { status: response.status, body: RegistrySummaryResponseSchema.parse(body) }; // prettier-ignore
}

/** One of the archive's own workbooks, through the operator's own route. */
async function load(name: string): Promise<void> {
  const form = new FormData();
  const bytes = await readFile(path.join(FIXTURES, 'archive', name));

  form.append('file', new Blob([new Uint8Array(bytes)]), name);

  const response = await fetch(`${baseUrl}/api/import/records`, {
    method: 'POST',
    body: form,
  });

  expect(response.status).toBe(200);
}

function line(
  body: RegistrySummaryResponse,
  id: string,
): { records: number; loadedAt: string | null } {
  const found = body.bySource.find(source => source.id === id);

  expect(found, `no line for ${id}`).toBeDefined();

  return found!;
}

describe('GET /api/registry/summary', () => {
  it('answers with what the register holds', async () => {
    // act
    const { status, body } = await summary();

    // assert — a GET, and 200: nothing is created by asking
    expect(status).toBe(200);
    expect(body.records).toBeGreaterThan(0);
    expect(body.loadedAt).not.toBeNull();
  });

  it('names every source the archive keeps, loaded or not', async () => {
    // act
    const { body } = await summary();

    // assert — which of the six is missing is the question being asked, and a
    // line that vanishes at zero cannot answer it
    expect(body.bySource.map(source => source.id)).toEqual(
      expect.arrayContaining(CATALOGUED),
    );
  });

  /*
   * The number beside the breakdown has to be the breakdown's own total, or a
   * reader is left adding up lines that do not reach it. The seeded cases carry
   * the archive's own name for the file they came off rather than a catalogue
   * identifier, and this is what says those records are stated rather than
   * dropped.
   */
  it('breaks the total down into lines that add up to it', async () => {
    // act
    const { body } = await summary();

    // assert
    expect(
      body.bySource.reduce((total, source) => total + source.records, 0),
    ).toBe(body.records);
    expect(body.sources).toBe(
      body.bySource.filter(source => source.records > 0).length,
    );
  });

  /*
   * The partially loaded archive, end to end and not as a fixture: a workbook
   * goes in through the operator's own route and the summary has to say so. It
   * is measured as a delta rather than against an absolute, because the API set
   * shares one database and this spec is not the only thing writing to it.
   */
  it('counts a register file that arrives, under its catalogue identifier', async () => {
    // arrange
    const { body: before } = await summary();

    // act
    await load('emdk.xlsx');
    const { body: after } = await summary();

    // assert
    expect(line(after, 'EMDK').records).toBeGreaterThan(0);
    expect(after.records).toBeGreaterThanOrEqual(before.records);
    expect(after.sources).toBeGreaterThanOrEqual(1);
  });

  it('dates a source by the load that last touched it', async () => {
    // arrange — the same file twice: a corrected workbook loaded again is a
    // fresher archive, not the one from the first attempt
    await load('emdk.xlsx');
    const { body: before } = await summary();

    // act
    await load('emdk.xlsx');
    const { body: after } = await summary();

    // assert
    expect(line(after, 'EMDK').loadedAt!).not.toBe(line(before, 'EMDK').loadedAt); // prettier-ignore
    expect(Date.parse(line(after, 'EMDK').loadedAt!)).toBeGreaterThan(
      Date.parse(line(before, 'EMDK').loadedAt!),
    );
    // The archive's own date is the latest of them.
    expect(after.loadedAt).toBe(
      after.bySource
        .map(source => source.loadedAt)
        .filter((at): at is string => at !== null)
        .sort()
        .at(-1),
    );
  });

  it('mounts the route under the prefix main.ts sets, and only there', async () => {
    // act
    const bare = await fetch(`${baseUrl}/registry/summary`);

    // assert
    expect(bare.status).toBe(404);
  });

  /*
   * `health` is what a compose healthcheck and the caller's start-up wait ask
   * dozens of times a minute, and it must stay as cheap as it is: it says the
   * process is answering and nothing about what the register loaded. The two
   * are different questions and they stay different routes.
   */
  it('leaves health saying only that the process answers', async () => {
    // act
    const response = await fetch(`${baseUrl}/api/health`);

    // assert
    expect(await response.json()).toEqual({ status: 'ok' });
  });
});
