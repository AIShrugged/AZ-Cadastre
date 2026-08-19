import type OpenAI from "openai";

// OpenRouter does not always report a failure as one. A provider that refused
// the request can come back as HTTP 200 carrying `{"error": …}` and no
// `choices` at all, which the SDK hands over as a completion like any other —
// and reading `choices[0]` off it raises `Cannot read properties of undefined`,
// a stage failure that says nothing about what went wrong.
//
// So the shape is checked once, here, and a route that answered with no answer
// is turned into an error that names itself.
export class ProviderAnsweredNothingException extends Error {
  constructor(model: string, completion: unknown) {
    super(
      `${model} returned no choice: ${describe(completion)}`,
    );
    this.name = "ProviderAnsweredNothingException";
  }
}

export function answerOf(
  model: string,
  completion: OpenAI.Chat.Completions.ChatCompletion,
): OpenAI.Chat.Completions.ChatCompletion.Choice {
  const choice = completion?.choices?.[0];

  if (!choice) throw new ProviderAnsweredNothingException(model, completion);

  return choice;
}

function describe(completion: unknown): string {
  const error = (completion as { error?: unknown })?.error;

  try {
    return JSON.stringify(error ?? completion).slice(0, 300);
  } catch {
    return String(error ?? completion).slice(0, 300);
  }
}
