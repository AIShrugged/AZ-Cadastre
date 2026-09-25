import { describe, expect, it, vi } from 'vitest';

import { SilentLogger } from '@cadastre/logger';

import { ObjectStorage } from '../../../application/ports/outbound/index.js';
import {
  ContentType,
  DocumentType,
  PageImage,
  PageNumber,
  RecognisedText,
  StorageKey,
  VerificationProfile,
} from '../../../domain/value-objects/index.js';
import type { VerificationModuleOptions } from '../../../verification.module-defs.js';

import { OpenRouterGeometryAdapter } from './geometry.adapter.js';

// What the stubbed route answers with. Set per test, read by the fake client
// the module mock below hands the adapter.
let answered = '{}';

vi.mock('openai', () => ({
  default: class {
    readonly chat = {
      completions: {
        create: async () => ({
          choices: [{ message: { content: answered } }],
        }),
      },
    };
  },
}));

const SKETCH = DocumentType.create('sketch_project');

const A_ROOM = {
  label: 'Qonaq otağı',
  outline: [
    { x: 0.2, y: 0.2 },
    { x: 0.6, y: 0.2 },
    { x: 0.6, y: 0.5 },
  ],
  walls: [{ from: 0, to: 1, printed: '4000' }],
};

// The sheets are fetched as bytes and never looked at: what is under test is
// what the adapter does with the answer, not what a model makes of a picture.
class OneStoredSheet extends ObjectStorage {
  override presignUpload(): never {
    throw new Error('the geometry reader never presigns an upload');
  }

  override presignDownload(): never {
    throw new Error('the geometry reader never presigns a download');
  }

  override putObject(): never {
    throw new Error('the geometry reader never writes an object');
  }

  override async getObject() {
    return { body: new Uint8Array([1, 2, 3]), contentType: ContentType.PNG };
  }
}

function read(sheets: readonly number[], answer: unknown) {
  answered = JSON.stringify(answer);

  const options = {
    openrouter: {
      apiKey: 'test-key',
      baseUrl: 'https://openrouter.test/api/v1',
      appTitle: 'cadastre-test',
    },
    geometry: { provider: 'openrouter', model: 'a/model' },
  } as VerificationModuleOptions;

  return new OpenRouterGeometryAdapter(
    options,
    new OneStoredSheet(),
    new SilentLogger(),
  ).read({
    sheets: sheets.map(number => ({
      number: PageNumber.of(number),
      image: PageImage.of(
        StorageKey.create(`sheet_${number}.png`),
        ContentType.PNG,
      ),
      text: RecognisedText.of(''),
    })),
    spec: VerificationProfile.CADASTRE.specFor(SKETCH),
  });
}

describe('OpenRouterGeometryAdapter', () => {
  it('reads the geometry of a sheet it was shown', async () => {
    const geometry = await read([7], {
      sheets: [{ sheet: 7, rooms: [A_ROOM], axes: [] }],
    });

    expect(geometry).toHaveLength(1);
    expect(geometry[0]?.pageNumber.value).toBe(7);
    expect(geometry[0]?.rooms[0]?.label).toBe('Qonaq otağı');
  });

  /*
   * Measured against the live model, 2026-09-25: `gemini-2.5-pro` answers
   * `"sheet": "5"` for the reference set's page 7 — a string, and the number
   * printed in the drawing's own title block ("Vərəq 5") rather than the one it
   * was shown the sheet under. A schema holding out for a number dropped the
   * entry and with it every room and axis on a sheet the model read correctly.
   */
  it('takes a sheet number answered as a string', async () => {
    const geometry = await read([7], {
      sheets: [{ sheet: '7', rooms: [A_ROOM], axes: [] }],
    });

    expect(geometry[0]?.pageNumber.value).toBe(7);
  });

  it('takes the one sheet it asked about when the reader numbered it as the drawing does', async () => {
    const geometry = await read([7], {
      sheets: [{ sheet: 5, rooms: [A_ROOM], axes: [] }],
    });

    expect(geometry[0]?.pageNumber.value).toBe(7);
  });

  /*
   * Where several sheets were asked about, a number nobody was shown is a
   * guess, and a guess here draws one floor's rooms onto another's plan.
   */
  it('drops an answer about a sheet nobody was shown, where several were asked about', async () => {
    const geometry = await read([7, 8], {
      sheets: [{ sheet: 5, rooms: [A_ROOM], axes: [] }],
    });

    expect(geometry).toEqual([]);
  });

  it('drops an answer it cannot read at all', async () => {
    answered = 'the drawing shows a house';

    expect(await read([7], undefined)).toEqual([]);
  });
});
