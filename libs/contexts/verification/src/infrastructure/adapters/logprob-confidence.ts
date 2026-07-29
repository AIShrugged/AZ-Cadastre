import type OpenAI from "openai";

// `exp(mean(logprob))` — the geometric mean of the per-token probabilities.
export function confidenceFromLogprobs(
  completion: OpenAI.Chat.Completions.ChatCompletion,
): number | null {
  const content = completion.choices[0]?.logprobs?.content;
  if (!content || content.length === 0) return null;
  const meanLogprob =
    content.reduce((sum, token) => sum + token.logprob, 0) / content.length;
  return Math.exp(meanLogprob);
}
