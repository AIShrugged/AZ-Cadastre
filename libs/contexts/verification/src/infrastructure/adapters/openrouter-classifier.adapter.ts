import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";

import {
  DocumentClassifier,
  type ClassificationRequest,
} from "../../application/ports/index.js";
import {
  Classification,
  Confidence,
  DocumentType,
} from "../../domain/value-objects/index.js";
import type { Environment } from "../config/index.js";
import { MissingOpenRouterApiKeyException } from "../exceptions/index.js";
import { confidenceFromLogprobs } from "./logprob-confidence.js";

const MAX_TEXT = 6000;

const NOMINAL_PLACED_CONFIDENCE = 0.9;
const NOMINAL_UNPLACED_CONFIDENCE = 0.3;

@Injectable()
export class OpenRouterClassifierAdapter extends DocumentClassifier {
  private readonly logger = new Logger(OpenRouterClassifierAdapter.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(config: ConfigService<Environment, true>) {
    super();
    const openrouter = config.get("openrouter", { infer: true });
    if (!openrouter.apiKey) {
      throw new MissingOpenRouterApiKeyException("CLASSIFIER_PROVIDER");
    }
    this.model = config.get("classifier", { infer: true }).model;
    this.client = new OpenAI({
      apiKey: openrouter.apiKey,
      baseURL: openrouter.baseUrl,
      defaultHeaders: { "X-Title": openrouter.appTitle },
    });
  }

  async classify(request: ClassificationRequest): Promise<Classification> {
    // "Could not place it" is an answer the model is allowed to give.
    const allowed = [...request.candidateTypes, DocumentType.UNKNOWN];
    const keys = allowed.map((type) => type.value);
    const text = request.text.value.slice(0, MAX_TEXT);

    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      logprobs: true,
      messages: [
        {
          role: "system",
          content:
            "You classify a single scanned document from its OCR text. " +
            `Choose exactly one type from this list: ${keys.join(", ")}. ` +
            `Use "${DocumentType.UNKNOWN.value}" if none clearly fit. The text ` +
            "may be in any language. Reply with ONLY the type key — no other words.",
        },
        { role: "user", content: text },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const type = this.match(raw, allowed);
    const confidence =
      confidenceFromLogprobs(completion) ??
      (type.isKnown
        ? NOMINAL_PLACED_CONFIDENCE
        : NOMINAL_UNPLACED_CONFIDENCE);
    this.logger.log(
      `Classified as "${type.value}" (model said "${raw}", confidence ${confidence.toFixed(3)})`,
    );

    return Classification.of(type, Confidence.of(confidence));
  }

  private match(
    raw: string,
    allowed: readonly DocumentType[],
  ): DocumentType {
    const answer = raw.toLowerCase();
    const exact = allowed.find((type) => type.value === answer);
    if (exact) return exact;
    const contained = allowed.find(
      (type) => type.isKnown && answer.includes(type.value),
    );
    return contained ?? DocumentType.UNKNOWN;
  }
}
