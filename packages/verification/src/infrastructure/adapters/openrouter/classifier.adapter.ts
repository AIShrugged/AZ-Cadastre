import { Inject, Injectable } from '@nestjs/common';
import OpenAI from 'openai';

import { Logger } from '@cadastre/logger';

import {
  DocumentClassifier,
  type ClassificationRequest,
} from '../../../application/ports/outbound/index.js';
import {
  Classification,
  Confidence,
  DocumentCatalogue,
  DocumentType,
} from '../../../domain/value-objects/index.js';
import {
  VERIFICATION_OPTIONS,
  type VerificationModuleOptions,
} from '../../../verification.module-defs.js';
import { MissingOpenRouterApiKeyException } from '../../exceptions/index.js';

import { answerOf } from './answered.js';
import {
  classificationInstructions,
  matchKey,
  readAnswer,
} from './classifier-prompt.js';
import { confidenceFromLogprobs } from './logprob-confidence.js';
import { telemetryOf } from './telemetry.js';

const MAX_TEXT = 8000;

// One document's text and one short answer.
const CLASSIFICATION_TIMEOUT_MS = 90_000;

@Injectable()
export class OpenRouterClassifierAdapter extends DocumentClassifier {
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
      throw new MissingOpenRouterApiKeyException('CLASSIFIER_PROVIDER');
    }
    this.model = options.classifier.model;
    this.logger = logger.child({
      scope: OpenRouterClassifierAdapter.name,
      model: this.model,
    });
    this.client = new OpenAI({
      apiKey: openrouter.apiKey,
      baseURL: openrouter.baseUrl,
      defaultHeaders: { 'X-Title': openrouter.appTitle },
      // A page the provider never answers about must not hold the pipeline
      // open: without these the SDK waits ten minutes and then retries twice,
      // so one stuck sheet can cost half an hour of a run that has already read
      // everything else. The per-sheet retry in the use case does the asking
      // again; this only bounds one ask.
      timeout: CLASSIFICATION_TIMEOUT_MS,
      maxRetries: 1,
    });
  }

  async classify(request: ClassificationRequest): Promise<Classification> {
    const text = request.text.value.slice(0, MAX_TEXT);
    const startedAt = Date.now();

    this.logger.debug('Asking what this document is', {
      characters: text.length,
      truncated: request.text.value.length > MAX_TEXT,
      candidates: request.candidates.map(candidate => candidate.type.value),
    });

    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      logprobs: true,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: classificationInstructions(request.candidates),
        },
        { role: 'user', content: text },
      ],
    });

    const raw = answerOf(this.model, completion).message?.content?.trim() ?? '';
    const answer = readAnswer(raw);

    if (!answer) {
      this.logger.warn("Could not read the classifier's JSON", {
        answered: raw.slice(0, 200),
      });
    }

    const catalogue = DocumentCatalogue.KNOWN;
    const allowed = [
      ...request.candidates.map(candidate => candidate.type),
      ...catalogue.types,
      DocumentType.OUT_OF_PROFILE,
      DocumentType.UNKNOWN,
    ];
    const answered = matchKey(answer?.type ?? raw, allowed);

    // The route's certainty about the tokens it wrote, and the model's own
    // account of how sure it is, are different things and both can flatter. The
    // lower of the two is what an inspector is told; where neither is on offer
    // the reading is recorded as unscored rather than as a number invented here,
    // which is what the old nominal 0.9 amounted to.
    const scored = confidenceFromLogprobs(completion);
    const stated = answer?.confidence ?? null;
    const confidence = leastOf(scored, stated);

    // A catalogued key is an out-of-profile reading that happens to have a
    // name. It never becomes the document's type: the type is what answers a
    // requirement, and none of these answer one (ADR-0012).
    const classification = catalogue.recognises(answered)
      ? Classification.outOfProfile(Confidence.of(confidence), answered)
      : Classification.of(answered, Confidence.of(confidence));

    this.logger.log('Document classified', {
      type: classification.type.value,
      knownAs: classification.knownAs?.value ?? null,
      // What the model answered, beside what that was read as: a type that
      // came back misspelled and a type that was matched loosely look the same
      // in the result and are not the same problem.
      modelSaid: answer?.type ?? raw.slice(0, 40),
      reason: answer?.reason?.slice(0, 120),
      confidence: round(confidence),
      logprobs: scored === null ? null : round(scored),
      stated: stated === null ? null : round(stated),
      durationMs: Date.now() - startedAt,
      ...telemetryOf(completion),
    });

    return classification;
  }
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

// Two accounts of the same certainty: take the lower, and take nothing as
// nothing — a reading no one scored is recorded at zero, which puts it below
// the floor and in front of the inspector.
function leastOf(left: number | null, right: number | null): number {
  const offered = [left, right].filter(
    (value): value is number => value !== null,
  );

  return offered.length === 0 ? 0 : Math.min(...offered);
}
