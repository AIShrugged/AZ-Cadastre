import type OpenAI from "openai";

/**
 * Derive a real 0..1 confidence from a chat completion's token logprobs: the
 * geometric mean of per-token probabilities, i.e. `exp(mean(logprob))`. This is
 * the model's own certainty in the tokens it produced.
 *
 * Returns null when the response carries no logprobs (the model/route didn't
 * support them, or `logprobs` wasn't requested), so callers fall back to a
 * nominal value instead of a fake number.
 */
export function confidenceFromLogprobs(
  completion: OpenAI.Chat.Completions.ChatCompletion,
): number | null {
  const content = completion.choices[0]?.logprobs?.content;
  if (!content || content.length === 0) return null;
  const meanLogprob =
    content.reduce((sum, token) => sum + token.logprob, 0) / content.length;
  return Math.exp(meanLogprob);
}
