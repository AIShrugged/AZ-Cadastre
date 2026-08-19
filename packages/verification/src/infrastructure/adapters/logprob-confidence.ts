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
  const choice = completion.choices[0];
  const content = choice?.logprobs?.content;
  if (!content || content.length === 0) return null;

  const answered = choice?.message?.content?.length ?? 0;
  if (answered > content.length * MAX_CHARACTERS_PER_TOKEN) return null;

  const saturated = content.every(token => token.logprob === 0);
  if (saturated && content.length >= SATURATION_FLOOR) return null;

  const meanLogprob =
    content.reduce((sum, token) => sum + token.logprob, 0) / content.length;

  return Math.exp(meanLogprob);
}
