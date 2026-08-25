import type OpenAI from 'openai';

/**
 * What the route said about answering, as fields for a log line.
 *
 * `upstream` is the one worth having: OpenRouter fans a single model id out
 * over several upstream providers, and they do not all behave the same — above
 * all about logprobs, which is what a confidence is made of (docs/MODELS.md).
 * When the same model reads the same page two different ways, this is the
 * first field to look at. It is not in the SDK's type, so it is read
 * defensively rather than declared.
 *
 * `generationId` is what the answer is called on OpenRouter's own activity
 * page: with it, a line in this log and a request in their records are the
 * same request.
 */
export function telemetryOf(
  completion: OpenAI.Chat.Completions.ChatCompletion,
): Record<string, unknown> {
  const usage = completion?.usage;

  return {
    generationId: completion?.id,
    upstream: (completion as { provider?: unknown })?.provider,
    finishReason: completion?.choices?.[0]?.finish_reason,
    tokens: usage
      ? {
          prompt: usage.prompt_tokens,
          completion: usage.completion_tokens,
          total: usage.total_tokens,
        }
      : undefined,
  };
}
