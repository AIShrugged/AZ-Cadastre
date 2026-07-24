import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";

import {
  DocumentClassifier,
  type Classification,
  type ClassifyInput,
} from "../../application/ports/document-classifier.port.js";
import { UNKNOWN_TYPE } from "../../domain/profiles.js";
import type { Environment } from "../config/env.shema.js";

/** OCR text past this length is truncated before classification (token cap). */
const MAX_TEXT = 6000;

/**
 * Real document classifier via OpenRouter (OpenAI-compatible). Sends the OCR
 * text plus the profile's candidate types to an LLM and takes back the one type
 * key it picks — language-agnostic, unlike the keyword mock (a Russian passport
 * says "Паспорт", not "passport"). Selected when CLASSIFIER_PROVIDER=openrouter.
 */
@Injectable()
export class OpenRouterClassifierAdapter extends DocumentClassifier {
  private readonly logger = new Logger(OpenRouterClassifierAdapter.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(config: ConfigService<Environment, true>) {
    super();
    const openrouter = config.get("openrouter", { infer: true });
    if (!openrouter.apiKey) {
      throw new Error(
        "CLASSIFIER_PROVIDER=openrouter requires OPENROUTER_API_KEY to be set",
      );
    }
    this.model = config.get("classifier", { infer: true }).model;
    this.client = new OpenAI({
      apiKey: openrouter.apiKey,
      baseURL: openrouter.baseUrl,
      defaultHeaders: { "X-Title": openrouter.appTitle },
    });
  }

  async classify(input: ClassifyInput): Promise<Classification> {
    const allowed = [...input.candidateTypes, UNKNOWN_TYPE];
    const text = input.text.slice(0, MAX_TEXT);

    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "You classify a single scanned document from its OCR text. " +
            `Choose exactly one type from this list: ${allowed.join(", ")}. ` +
            `Use "${UNKNOWN_TYPE}" if none clearly fit. The text may be in any ` +
            "language. Reply with ONLY the type key — no other words.",
        },
        { role: "user", content: text },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const type = this.match(raw, allowed);
    this.logger.log(`Classified as "${type}" (model said "${raw}")`);
    return {
      type,
      confidence: type === UNKNOWN_TYPE ? 0.3 : 0.9,
    };
  }

  /** Map the model's reply onto an allowed key (exact, then substring). */
  private match(raw: string, allowed: string[]): string {
    const answer = raw.toLowerCase();
    const exact = allowed.find((t) => t === answer);
    if (exact) return exact;
    const contained = allowed.find(
      (t) => t !== UNKNOWN_TYPE && answer.includes(t),
    );
    return contained ?? UNKNOWN_TYPE;
  }
}
