import { Inject, Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { z } from 'zod';

import { Logger } from '@cadastre/logger';

import {
  CrossChecker,
  type CrossCheckAnswer,
  type CrossCheckRequest,
} from '../../../application/ports/outbound/index.js';
import {
  Confidence,
  CrossCheckVerdict,
  type CheckedValue,
  type CrossCheckSpec,
} from '../../../domain/value-objects/index.js';
import {
  VERIFICATION_OPTIONS,
  type VerificationModuleOptions,
} from '../../../verification.module-defs.js';
import { MissingOpenRouterApiKeyException } from '../../exceptions/index.js';

import { answerOf } from './answered.js';
import { confidenceFromLogprobs } from './logprob-confidence.js';
import { telemetryOf } from './telemetry.js';

const AnswerSchema = z.object({
  verdict: z.string(),
  confidence: z.number().min(0).max(1).nullish(),
  reason: z.string().nullish(),
});

const NOTE_MAX = 240;

// A handful of short values and one short answer: nothing here is an image.
const CROSS_CHECK_TIMEOUT_MS = 90_000;

// "mismatch" contains "match", so the longer word is looked for first — read
// the other way round, every disagreement would be recorded as an agreement.
const VERDICTS: readonly (readonly [string, CrossCheckVerdict])[] = [
  ['mismatch', CrossCheckVerdict.MISMATCH],
  ['unclear', CrossCheckVerdict.UNCLEAR],
  ['match', CrossCheckVerdict.MATCH],
];

@Injectable()
export class OpenRouterCrossCheckerAdapter extends CrossChecker {
  private readonly logger: Logger;
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(
    @Inject(VERIFICATION_OPTIONS) options: VerificationModuleOptions,
    @Inject(Logger) logger: Logger,
  ) {
    super();
    const openrouter = options.openrouter;
    if (!openrouter.apiKey) {
      throw new MissingOpenRouterApiKeyException('CROSS_CHECKER_PROVIDER');
    }
    this.model = options.crossChecker.model;
    this.logger = logger.child({
      scope: OpenRouterCrossCheckerAdapter.name,
      model: this.model,
    });
    this.client = new OpenAI({
      apiKey: openrouter.apiKey,
      baseURL: openrouter.baseUrl,
      defaultHeaders: { 'X-Title': openrouter.appTitle },
      timeout: CROSS_CHECK_TIMEOUT_MS,
      maxRetries: 1,
    });
  }

  async check(request: CrossCheckRequest): Promise<CrossCheckAnswer> {
    const startedAt = Date.now();

    this.logger.debug('Holding values against each other', {
      check: request.spec.key.value,
      agreesWhen: request.spec.agreesWhen,
      values: request.values.map(value => ({
        of: `${value.documentType.value}.${value.fieldKey.value}`,
        confidence: Math.round(value.confidence.value * 1000) / 1000,
      })),
    });

    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      logprobs: true,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: this.instructions(request.spec) },
        { role: 'user', content: this.evidence(request.values) },
      ],
    });

    const raw = answerOf(this.model, completion).message?.content?.trim() ?? '';
    const answer = this.parse(raw);
    const verdict = this.verdictOf(answer?.verdict ?? raw);

    // The route's certainty about the tokens it wrote and the model's own
    // account of how sure it is are different things and both can flatter. The
    // lower of the two is what an inspector is told, and where neither is on
    // offer the check is recorded as unscored rather than as a number invented
    // here — which puts it below the floor and in front of them.
    const scored = confidenceFromLogprobs(completion);
    const stated = answer?.confidence ?? null;
    const confidence = leastOf(scored, stated);
    const note = (answer?.reason ?? '').trim().slice(0, NOTE_MAX);

    this.logger.log('Cross-check answered', {
      check: request.spec.key.value,
      verdict: verdict.value,
      modelSaid: answer?.verdict ?? raw.slice(0, 40),
      note,
      confidence: round(confidence),
      logprobs: scored === null ? null : round(scored),
      stated: stated === null ? null : round(stated),
      durationMs: Date.now() - startedAt,
      ...telemetryOf(completion),
    });

    return { verdict, confidence: Confidence.of(confidence), note };
  }

  private instructions(spec: CrossCheckSpec): string {
    return [
      'You compare values that were read off several documents of one',
      'submission to the Azerbaijani real estate registration authority — a',
      'land parcel plan, an order, a receipt, an application, an identity',
      'card. The registrar requires these documents to agree on the value',
      'below; an inspector will act on your answer, and can open every sheet',
      'you are quoting from.',
      '',
      `WHAT IS COMPARED — ${spec.key.value}`,
      spec.description,
      '',
      'WHAT COUNTS AS AGREEMENT',
      spec.agreesWhen,
      '',
      "The values were transcribed from scans, so they carry the scan's own",
      'noise: dropped diacritics (ə→e, ı→i, ş→s, ç→c, ğ→g), Latin and Cyrillic',
      'spellings of one Azerbaijani word, OCR confusions (0/O, 1/l/I, 5/S), and',
      'Azerbaijani case endings that forms attach to names. None of those is a',
      'disagreement between the documents — they are a disagreement between the',
      'scanner and the paper.',
      '',
      'A value from the same document may arrive in several parts (a surname',
      "and a given name in fields of their own). Read one document's parts",
      "together as that document's single statement, then hold the documents",
      'against each other.',
      '',
      'Answer with exactly one verdict:',
      '- match: every document states the same value, allowing only what the',
      '  rule above allows.',
      '- mismatch: at least two documents state values that are genuinely',
      '  different — a different person, place, parcel, number or amount.',
      '- unclear: you cannot tell. A value is too damaged to compare, or the',
      '  difference could be either a transcription artefact or a real one.',
      "  Prefer this over guessing: an honest 'unclear' costs the inspector one",
      "  look at the sheet, a wrong 'match' costs a wrong registration.",
      '',
      'Do not decide whether the package is acceptable, and do not consider',
      'anything but the values given. A value that is absent is not a',
      'disagreement — it is a document nobody read that field off, and it is',
      'reported elsewhere.',
      '',
      // The word "JSON" is load-bearing: OpenAI refuses `response_format:
      // json_object` outright — 400, no completion — unless the conversation
      // says it somewhere.
      'Reply with ONLY this JSON object:',
      '{"verdict":"match|mismatch|unclear","confidence":<0..1, how sure you',
      'are of that verdict>,"reason":"<up to 20 words, in English, naming the',
      'values you compared>"}',
    ].join('\n');
  }

  private evidence(values: readonly CheckedValue[]): string {
    return values
      .map(value =>
        [
          `--- ${value.documentType.value} · ${value.fieldKey.value} ` +
            `(document ${value.documentId.value.slice(0, 8)}, sheet ` +
            `${value.foundOn.value}, read at ${value.confidence.value.toFixed(2)}) ---`,
          value.value.value,
        ].join('\n'),
      )
      .join('\n\n');
  }

  private verdictOf(raw: string): CrossCheckVerdict {
    const answer = raw.toLowerCase();
    const found = VERDICTS.find(([word]) => answer.includes(word));

    // An answer nobody can read is not an agreement, and saying so is the
    // honest reading of it.
    return found?.[1] ?? CrossCheckVerdict.UNCLEAR;
  }

  private parse(raw: string): z.infer<typeof AnswerSchema> | null {
    const json = raw.match(/\{[\s\S]*\}/)?.[0] ?? raw;

    try {
      const parsed = AnswerSchema.safeParse(JSON.parse(json));
      if (parsed.success) return parsed.data;
    } catch {
      // A model that answered with a bare word rather than an object is still
      // answering; `verdictOf` reads the word straight out of the raw text.
    }

    this.logger.warn("Could not read the cross-checker's JSON", {
      answered: raw.slice(0, 200),
    });
    return null;
  }
}

function leastOf(left: number | null, right: number | null): number {
  const offered = [left, right].filter(
    (value): value is number => value !== null,
  );

  return offered.length === 0 ? 0 : Math.min(...offered);
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}
