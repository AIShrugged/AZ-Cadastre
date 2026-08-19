import type OpenAI from 'openai';
import { describe, expect, it } from 'vitest';

import { Confidence } from '../../domain/value-objects/index.js';

import { confidenceFromLogprobs } from './logprob-confidence.js';

let sequence = 0;

function anId(): string {
  sequence += 1;
  return `chatcmpl-${sequence.toString(16).padStart(12, '0')}`;
}

function aToken(
  logprob: number,
): OpenAI.Chat.Completions.ChatCompletionTokenLogprob {
  return { token: 'AZ', bytes: [65, 90], logprob, top_logprobs: [] };
}

function aCompletion(
  logprobs: OpenAI.Chat.Completions.ChatCompletion.Choice['logprobs'],
  content = 'passport',
): OpenAI.Chat.Completions.ChatCompletion {
  return {
    id: anId(),
    object: 'chat.completion',
    created: 1_772_000_000,
    model: 'openai/gpt-4o-mini',
    choices: [
      {
        index: 0,
        finish_reason: 'stop',
        logprobs,
        message: { role: 'assistant', content, refusal: null },
      },
    ],
  };
}

// A page of transcription, which is what the OCR stage actually asks a route
// for and what makes a one-entry logprob table obviously a stand-in.
function aTranscribedPage(
  tokenCount: number,
  logprob: number,
): OpenAI.Chat.Completions.ChatCompletion {
  return aCompletion(
    {
      content: Array.from({ length: tokenCount }, () => aToken(logprob)),
      refusal: null,
    },
    'ARXİV ARAYIŞI '.repeat(60),
  );
}

function aCompletionWithLogprobs(
  ...logprobs: readonly number[]
): OpenAI.Chat.Completions.ChatCompletion {
  return aCompletion({ content: logprobs.map(aToken), refusal: null });
}

describe('confidenceFromLogprobs', () => {
  it('has nothing to say when the route answered without logprobs at all', () => {
    expect(confidenceFromLogprobs(aCompletion(null))).toBeNull();
  });

  it('has nothing to say when the logprobs block carries no content tokens', () => {
    expect(
      confidenceFromLogprobs(aCompletion({ content: null, refusal: null })),
    ).toBeNull();
  });

  it('has nothing to say when the content token list came back empty', () => {
    expect(confidenceFromLogprobs(aCompletionWithLogprobs())).toBeNull();
  });

  it('has nothing to say when the completion carries no choice to read', () => {
    const completion = aCompletion(null);

    expect(confidenceFromLogprobs({ ...completion, choices: [] })).toBeNull();
  });

  it("reads a single token's certainty as the probability of that token", () => {
    const confidence = confidenceFromLogprobs(aCompletionWithLogprobs(-0.5));

    expect(confidence).toBeCloseTo(Math.exp(-0.5), 12);
  });

  it('reads several tokens as the geometric mean of their probabilities', () => {
    const confidence = confidenceFromLogprobs(
      aCompletionWithLogprobs(-0.2, -0.4, -0.6),
    );

    expect(confidence).toBeCloseTo(Math.exp(-0.4), 12);
  });

  it("reports total certainty when every token was the model's certain choice", () => {
    expect(confidenceFromLogprobs(aCompletionWithLogprobs(0, 0, 0))).toBe(1);
  });

  it('reports nearly nothing when the model was very unsure of its tokens', () => {
    const confidence = confidenceFromLogprobs(
      aCompletionWithLogprobs(-9999, -9999),
    );

    expect(confidence).toBe(0);
  });

  it('stays inside 0..1 whatever the tokens, so the domain accepts it as a confidence', () => {
    const samples = [
      aCompletionWithLogprobs(0),
      aCompletionWithLogprobs(-0.0001),
      aCompletionWithLogprobs(-0.2, -0.4, -0.6),
      aCompletionWithLogprobs(-3.5, -0.1),
      aCompletionWithLogprobs(-9999, -0.1),
    ];

    for (const completion of samples) {
      const confidence = confidenceFromLogprobs(completion);

      expect(confidence).not.toBeNull();
      expect(confidence!).toBeGreaterThanOrEqual(0);
      expect(confidence!).toBeLessThanOrEqual(1);
      expect(Confidence.of(confidence!).value).toBe(confidence);
    }
  });

  it('refuses a table too small to have scored the answer it came with', () => {
    // What some routes answer: one entry standing in for 840 characters of
    // transcription, which averages to certainty about a page nobody scored.
    expect(confidenceFromLogprobs(aTranscribedPage(1, -0.02))).toBeNull();
  });

  it('refuses a table of nothing but certainty, which is the route talking about itself', () => {
    expect(confidenceFromLogprobs(aTranscribedPage(400, 0))).toBeNull();
  });

  it('still scores a short answer the model was simply sure of', () => {
    // Three certain tokens for the word "passport" is a model agreeing with
    // itself, not a route declining to say — the refusals above must not eat it.
    expect(confidenceFromLogprobs(aCompletionWithLogprobs(0, 0, 0))).toBe(1);
  });

  it('scores a page whose entries are real, however many of them there are', () => {
    const confidence = confidenceFromLogprobs(aTranscribedPage(400, -0.2));

    expect(confidence).toBeCloseTo(Math.exp(-0.2), 12);
  });

  it('reads only the first choice, because that is the answer the caller asked for', () => {
    const first = aCompletionWithLogprobs(-0.5);
    const second = aCompletionWithLogprobs(-4);

    const completion: OpenAI.Chat.Completions.ChatCompletion = {
      ...first,
      choices: [...first.choices, ...second.choices],
    };

    expect(confidenceFromLogprobs(completion)).toBeCloseTo(Math.exp(-0.5), 12);
  });
});
