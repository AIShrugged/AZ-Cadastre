import type OpenAI from 'openai';

// OpenRouter fans one model id out over several upstream providers, and they do
// not all mean the same thing by `logprobs: true`. Three answers come back:
//
//   a real table  — one entry per generated token, with the certainty it was
//                   generated at. This is the only one worth a number.
//   a stub        — a single entry standing in for a whole page of text, which
//                   averages to "certain" no matter what the model actually did.
//   a saturated   — an entry per token, every one of them logprob 0. A greedy
//     table         decode reported as flawless, which reads 1.00 for a page the
//                   model in fact guessed its way through.
//
// A confidence must be earned, so the two impostors are refused here and the
// caller is told there is no reading — better an honest absence than a 1.00 the
// inspector would take for certainty. See docs/MODELS.md for which routes
// answer which way.

// A token is a few characters. A "table" claiming otherwise is standing in for
// text it never scored — 12 is well past any real tokeniser and well under the
// hundreds of characters per token a stub reports.
const MAX_CHARACTERS_PER_TOKEN = 12;

// Below this a run of certain tokens is ordinary: a one-word answer the model
// had no reason to doubt. Above it, flawlessness is a property of the route
// rather than of the reading.
const SATURATION_FLOOR = 32;

export function confidenceFromLogprobs(
  completion: OpenAI.Chat.Completions.ChatCompletion,
): number | null {
  const scored = scoredTokens(completion);
  if (!scored) return null;

  return geometricMean(scored);
}

/*
 * The certainty of one field of a JSON answer, rather than of the whole answer.
 *
 * An answer that carries both a decision and a sentence about the decision
 * cannot be scored as one thing. The cross-checker replies with a `verdict` and
 * a free `reason` naming the values it compared, and those values are
 * Azerbaijani place names, house numbers and Cyrillic spellings — high
 * perplexity prose that no model is confident in the way it is confident of the
 * word "mismatch". Averaged together, the certainty of the decision is replaced
 * by the certainty of the wording, and a disagreement nobody doubts arrives at
 * the inspector wearing the same 0.50 as a badly read field (PRD §4).
 *
 * So the window is narrowed to the tokens the field's own value was written in.
 * The field is located in the text the table itself spells out, because that is
 * the only text whose offsets line up with the tokens; a field that cannot be
 * found there is reported as unscored rather than as the whole answer's mean,
 * since falling back to the mean is the very number this exists to refuse.
 */
export function confidenceOfJsonField(
  completion: OpenAI.Chat.Completions.ChatCompletion,
  field: string,
): number | null {
  const scored = scoredTokens(completion);
  if (!scored) return null;

  const written = scored.map(token => token.token);
  const span = spanOfJsonField(written.join(''), field);
  if (!span) return null;

  const within: OpenAI.Chat.Completions.ChatCompletionTokenLogprob[] = [];
  let offset = 0;

  for (const [index, token] of scored.entries()) {
    const end = offset + written[index]!.length;
    // A token that straddles the opening quote carries part of the value with
    // it, and the certainty of that part is certainty about the value.
    if (offset < span.end && end > span.start) within.push(token);
    offset = end;
  }

  return within.length === 0 ? null : geometricMean(within);
}

// The tokens of the first choice, or nothing where what came back is one of the
// two impostors above. Both refusals are judged on the whole answer: a stub
// stands in for all of it, and a saturated table is the route's habit rather
// than anything about the field being read out of it.
function scoredTokens(
  completion: OpenAI.Chat.Completions.ChatCompletion,
): readonly OpenAI.Chat.Completions.ChatCompletionTokenLogprob[] | null {
  const choice = completion.choices[0];
  const content = choice?.logprobs?.content;
  if (!content || content.length === 0) return null;

  const answered = choice?.message?.content?.length ?? 0;
  if (answered > content.length * MAX_CHARACTERS_PER_TOKEN) return null;

  const saturated = content.every(token => token.logprob === 0);
  if (saturated && content.length >= SATURATION_FLOOR) return null;

  return content;
}

function geometricMean(
  tokens: readonly OpenAI.Chat.Completions.ChatCompletionTokenLogprob[],
): number {
  const meanLogprob =
    tokens.reduce((sum, token) => sum + token.logprob, 0) / tokens.length;

  return Math.exp(meanLogprob);
}

// Where the field's value sits in the answer, quotes excluded. Only string
// values are looked for: the fields this scores are decisions written as words.
function spanOfJsonField(
  text: string,
  field: string,
): { start: number; end: number } | null {
  const key = field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const found = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`).exec(
    text,
  );
  const value = found?.[1];
  if (found === null || value === undefined || value.length === 0) return null;

  // The value is the last thing in the match before its closing quote.
  const start = found.index + found[0].length - 1 - value.length;

  return { start, end: start + value.length };
}
