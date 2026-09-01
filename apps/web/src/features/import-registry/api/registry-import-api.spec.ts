import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { RegistryImportReport } from '../model/types';

import { importRegistryWorkbook } from './registry-import-api';

vi.mock('axios', () => ({
  default: { post: vi.fn() },
}));

const post = vi.mocked(axios.post);

const REPORT: RegistryImportReport = {
  accepted: false,
  imported: 2,
  refused: 1,
  rows: {
    addresses: 4,
    rightHolders: 2,
    documents: 3,
    aliases: 1,
    locations: 2,
  },
  problems: [
    {
      sheet: 'Objects',
      row: 4,
      column: 'sourceDatabase',
      message: 'must not be empty',
    },
  ],
  note: 'Imported 2 objects, refused 1.',
};

const workbook = new File([], 'registry-import-template.xlsx');

beforeEach(() => {
  post.mockReset();
  post.mockResolvedValue({ data: REPORT });
});

describe('importRegistryWorkbook', () => {
  it('posts the workbook to the register’s own import endpoint', async () => {
    await importRegistryWorkbook(workbook);

    const [url, body] = post.mock.calls[0];
    // Not the gateway: the register is a different system and this endpoint is
    // deliberately outside @cadastre/api-contracts (ADR-0011 §1).
    expect(url).toBe('/registry/api/import/records');
    expect(body).toBeInstanceOf(FormData);
    // The field name the register's FileInterceptor is bound to. Renaming it
    // makes every upload a 400 that says the file is missing.
    expect((body as FormData).get('file')).toBe(workbook);
  });

  it('leaves the multipart Content-Type to axios', async () => {
    await importRegistryWorkbook(workbook);

    // A boundary written by hand is a body the register cannot split, so the
    // request must carry no Content-Type of its own.
    expect(post.mock.calls[0][2]?.headers).toBeUndefined();
  });

  it('hands back the register’s report unchanged', async () => {
    await expect(importRegistryWorkbook(workbook)).resolves.toEqual(REPORT);
  });

  it('reports transfer progress as whole percent', async () => {
    const seen: number[] = [];
    post.mockImplementation((_url, _body, config) => {
      config?.onUploadProgress?.({
        loaded: 0,
        total: 400,
        bytes: 0,
        lengthComputable: true,
      });
      config?.onUploadProgress?.({
        loaded: 133,
        total: 400,
        bytes: 133,
        lengthComputable: true,
      });
      config?.onUploadProgress?.({
        loaded: 400,
        total: 400,
        bytes: 267,
        lengthComputable: true,
      });
      return Promise.resolve({ data: REPORT });
    });

    await importRegistryWorkbook(workbook, { onProgress: p => seen.push(p) });

    expect(seen).toEqual([0, 33, 100]);
  });

  it('falls back to the file size when the transfer reports no total', async () => {
    const sized = new File([], 'big.xlsx');
    Object.defineProperty(sized, 'size', { value: 200 });
    const seen: number[] = [];
    post.mockImplementation((_url, _body, config) => {
      config?.onUploadProgress?.({
        loaded: 100,
        bytes: 100,
        lengthComputable: false,
      });
      return Promise.resolve({ data: REPORT });
    });

    await importRegistryWorkbook(sized, { onProgress: p => seen.push(p) });

    expect(seen).toEqual([50]);
  });

  it('lets a refusal through to the caller', async () => {
    const refusal = new Error('not a workbook');
    post.mockRejectedValue(refusal);

    await expect(importRegistryWorkbook(workbook)).rejects.toBe(refusal);
  });

  it('passes the caller’s abort signal to the transport', async () => {
    const controller = new AbortController();

    await importRegistryWorkbook(workbook, { signal: controller.signal });

    expect(post.mock.calls[0][2]?.signal).toBe(controller.signal);
  });
});
