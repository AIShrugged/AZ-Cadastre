import { beforeEach, describe, expect, it, vi } from 'vitest';

import { SilentLogger } from '@cadastre/logger';

import { ObjectStorage } from '../../../application/ports/outbound/index.js';
import {
  Confidence,
  DocumentType,
  FieldSchema,
  FieldSpec,
  PageNumber,
  RecognisedText,
  VerificationProfile,
  type DocumentTypeSpec,
} from '../../../domain/value-objects/index.js';
import type { VerificationModuleOptions } from '../../../verification.module-defs.js';

import { OpenRouterFieldExtractorAdapter } from './field-extractor.adapter.js';

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

// The sheet the answers are said to come off, read cleanly — so nothing but the
// answer itself decides whether a field is made.
const TEXT = 'Ümumi sahə: 120 m2\nTikinti həcmi: 480 m3';

class StorageStandingIn extends ObjectStorage {
  override presignUpload(): never {
    throw new Error('the extractor never presigns an upload');
  }

  override presignDownload(): never {
    throw new Error('the extractor never presigns a download');
  }

  override putObject(): never {
    throw new Error('the extractor never writes an object');
  }

  override getObject(): never {
    throw new Error('this document has no pictures to fetch');
  }
}

function specOf(schema: FieldSchema): DocumentTypeSpec {
  return { ...VerificationProfile.CADASTRE.specFor(SKETCH), schema };
}

const SCHEMA = FieldSchema.of([
  FieldSpec.of('total_area', 'Total area'),
  FieldSpec.of('building_volume', 'Building volume'),
]);

function extract(fields: Record<string, unknown>) {
  answered = JSON.stringify({ fields });

  const options = {
    openrouter: {
      apiKey: 'test-key',
      baseUrl: 'https://openrouter.test/api/v1',
      appTitle: 'cadastre-test',
    },
    extractor: { provider: 'openrouter', model: 'a/model' },
  } as VerificationModuleOptions;

  return new OpenRouterFieldExtractorAdapter(
    options,
    new StorageStandingIn(),
    new SilentLogger(),
  ).extract({
    text: RecognisedText.of(TEXT),
    sheets: [
      {
        number: PageNumber.of(1),
        image: null,
        text: RecognisedText.of(TEXT),
        read: Confidence.of(0.95),
      },
    ],
    spec: specOf(SCHEMA),
  });
}

const answerOf = (value: string) => ({
  value,
  sheet: 1,
  evidence: 'Ümumi sahə: 120 m2',
  confidence: 0.9,
});

describe('OpenRouterFieldExtractorAdapter', () => {
  beforeEach(() => {
    answered = '{}';
  });

  it('makes no field out of a model that answered the word "null"', async () => {
    const fields = await extract({
      total_area: answerOf('null'),
      building_volume: answerOf('480 m3'),
    });

    expect(fields.map(field => field.key.value)).toEqual(['building_volume']);
  });

  /*
   * The words a model reaches for when it means it found nothing. Every one of
   * them reached the operator as «Заявлено: <слово> — не понято», which reads
   * as a broken calculation rather than as a field the paper does not state
   * (COMM-157).
   */
  it.each(['null', 'NULL', ' none ', 'N/A', 'na', '-', '—', 'Нет', 'Yoxdur'])(
    'makes no field out of the stand-in answer %j',
    async word => {
      const fields = await extract({ total_area: answerOf(word) });

      expect(fields).toEqual([]);
    },
  );

  it('still makes a field out of a value that merely contains one of the words', async () => {
    const fields = await extract({ total_area: answerOf('Nalbandov 12') });

    expect(fields.map(field => field.value.value)).toEqual(['Nalbandov 12']);
  });

  /*
   * A value the model gave no confidence for is not a value the model doubts:
   * with no logprobs on the route and no `confidence` in the answer the
   * adapter's own floor of zero applies, and dropping fields at zero would drop
   * good readings for want of a number nobody promised. Absence is said with a
   * word or a null, not with a score.
   */
  it('keeps a real value the model stated no confidence for', async () => {
    const fields = await extract({
      total_area: { value: '120 m2', sheet: 1, evidence: null },
    });

    expect(fields.map(field => field.value.value)).toEqual(['120 m2']);
    expect(fields[0]?.confidence.value).toBe(0);
  });

  it('makes no field out of a JSON null, as it always did', async () => {
    const fields = await extract({ total_area: null });

    expect(fields).toEqual([]);
  });
});
