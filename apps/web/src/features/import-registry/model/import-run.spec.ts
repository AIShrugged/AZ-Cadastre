/**
 * Which endings of an import leave the archive band's figures standing, and
 * which one makes it re-ask.
 *
 * The re-asking itself — that the tag on one side reaches the query on the
 * other — is `entities/archive-record/api/archive-api.spec.ts`. What is settled
 * here is when it is said at all.
 */
import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { archiveHoldingsChanged } from '@/entities/archive-record';

import { runImport } from './import-run';
import type { RegistryImportReport } from './types';

// `create` as well as the two this module uses: `shared/api` builds its own
// axios instance at import time, and a mock without it takes the whole module
// graph down before a test runs.
vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    isCancel: vi.fn(() => false),
    create: vi.fn(() => ({})),
  },
}));

const post = vi.mocked(axios.post);
const isCancel = vi.mocked(axios.isCancel);

const report = (
  over: Partial<RegistryImportReport> = {},
): RegistryImportReport => ({
  accepted: true,
  source: {
    kind: 'Template',
    register: null,
    file: null,
    detectedBy: 'sheets',
    confidence: null,
    reason: 'The workbook carries an "Objects" sheet.',
    sheets: [{ name: 'Objects', rows: 3, columns: { named: 5, read: 5 } }],
  },
  imported: 3,
  refused: 0,
  rows: {
    addresses: 3,
    rightHolders: 3,
    documents: 3,
    aliases: 0,
    locations: 3,
  },
  problems: [],
  note: 'Imported 3 objects.',
  ...over,
});

const workbook = new File([], 'registry-import-template.xlsx');

/** What the modal was told, in order, and what the store was told at all. */
const run = async () => {
  const phases: string[] = [];
  const dispatch = vi.fn();
  await runImport(workbook, {
    onPhase: phase => phases.push(phase.kind),
    dispatch,
    signal: new AbortController().signal,
    unreachable: 'The register did not answer.',
  });
  return { phases, dispatch };
};

/** The action the store reads as "the archive is not what it was". */
const REFRESH = archiveHoldingsChanged();

beforeEach(() => {
  post.mockReset();
  isCancel.mockReset();
  isCancel.mockReturnValue(false);
});

describe('runImport', () => {
  it('has the archive re-counted once the register has reported', async () => {
    post.mockResolvedValue({ data: report() });

    const { phases, dispatch } = await run();

    expect(phases).toEqual(['sending', 'reported']);
    expect(dispatch).toHaveBeenCalledWith(REFRESH);
  });

  it('re-counts after a workbook the register only partly took', async () => {
    // Two objects stored and one refused is not a failed import: the archive
    // holds two rows it did not hold a minute ago, and the band is still
    // showing the count from before them.
    post.mockResolvedValue({
      data: report({ accepted: false, imported: 2, refused: 1 }),
    });

    const { phases, dispatch } = await run();

    expect(phases).toEqual(['sending', 'reported']);
    expect(dispatch).toHaveBeenCalledWith(REFRESH);
  });

  it('leaves the figures alone when the transfer was cancelled', async () => {
    post.mockRejectedValue(new Error('canceled'));
    isCancel.mockReturnValue(true);

    const { phases, dispatch } = await run();

    // Nothing was reported and the modal that would have shown it is gone.
    expect(phases).toEqual(['sending']);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('leaves the figures alone when the register refused the workbook', async () => {
    post.mockRejectedValue({
      response: {
        data: {
          statusCode: 400,
          code: 'VALIDATION_FAILED',
          message: 'Sheet "Objects" is missing column "sourceDatabase".',
        },
      },
    });

    const { phases, dispatch } = await run();

    expect(phases).toEqual(['sending', 'failed']);
    // The register stored nothing it told us about, so a re-ask would spend a
    // call to be told the same figures.
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('says the register never answered when it never answered', async () => {
    post.mockRejectedValue(new Error('Network Error'));

    const phases: string[] = [];
    const messages: string[] = [];
    const dispatch = vi.fn();
    await runImport(workbook, {
      onPhase: phase => {
        phases.push(phase.kind);
        if (phase.kind === 'failed') messages.push(phase.message);
      },
      dispatch,
      signal: new AbortController().signal,
      unreachable: 'The register did not answer.',
    });

    expect(messages).toEqual(['The register did not answer.']);
    expect(dispatch).not.toHaveBeenCalled();
  });

  it('reports the transfer’s progress as it goes', async () => {
    post.mockImplementation((_url, _body, config) => {
      config?.onUploadProgress?.({
        loaded: 200,
        total: 400,
        bytes: 200,
        lengthComputable: true,
      });
      return Promise.resolve({ data: report() });
    });

    const progress: number[] = [];
    await runImport(workbook, {
      onPhase: phase => {
        if (phase.kind === 'sending') progress.push(phase.progress);
      },
      dispatch: vi.fn(),
      signal: new AbortController().signal,
      unreachable: 'The register did not answer.',
    });

    // Nought first, so the bar is on screen before the first byte lands.
    expect(progress).toEqual([0, 50]);
  });
});
