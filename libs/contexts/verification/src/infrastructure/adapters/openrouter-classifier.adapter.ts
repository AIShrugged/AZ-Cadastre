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
  type DocumentTypeSpec,
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
    const text = request.text.value.slice(0, MAX_TEXT);

    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      logprobs: true,
      messages: [
        { role: "system", content: this.instructions(request.candidates) },
        { role: "user", content: text },
      ],
    });

    const raw = completion.choices[0]?.message?.content?.trim() ?? "";
    const allowed = [
      ...request.candidates.map((candidate) => candidate.type),
      DocumentType.UNKNOWN,
    ];
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

  private instructions(candidates: readonly DocumentTypeSpec[]): string {
    return [
      "You classify one scanned document submitted to the Azerbaijani real",
      "estate registration authority. You are given the OCR text of that",
      "document — one document, though it may run over several sheets.",
      "",
      "The text is usually Azerbaijani (Latin script), sometimes Russian or",
      "English, and often a mix. OCR is imperfect: headings may be misspelled,",
      "diacritics dropped (ə→e, ı→i, ş→s) and letters confused. Judge by what",
      "the document evidently IS, not by an exact string match.",
      "",
      "Choose exactly one type key from this list:",
      "",
      ...candidates.map((candidate) => this.describe(candidate)),
      "",
      `- ${DocumentType.UNKNOWN.value}`,
      "  Nothing above fits, or the text is too damaged to tell. Prefer this",
      "  over a guess you are not reasonably sure of — a wrong type is worse",
      "  for the inspector than an honest 'unknown'.",
      "",
      "Weigh the whole document, above all its heading and its issuing body.",
      "A type mentioned in passing — a licence number quoted on an application —",
      "does not make the document that type.",
      "",
      "Reply with ONLY the type key. No punctuation, no explanation.",
    ].join("\n");
  }

  private describe(candidate: DocumentTypeSpec): string {
    const headings = candidate.hints.map((hint) => `"${hint}"`).join(", ");

    return [
      `- ${candidate.type.value}`,
      `  ${candidate.description}`,
      `  Usually headed: ${headings}.`,
    ].join("\n");
  }

  private match(raw: string, allowed: readonly DocumentType[]): DocumentType {
    const answer = raw.toLowerCase();
    const exact = allowed.find((type) => type.value === answer);
    if (exact) return exact;
    // The longest key contained in the answer, so "license_annex" is not read
    // as "license" when the model wrapped its choice in a sentence.
    const contained = allowed
      .filter((type) => type.isKnown && answer.includes(type.value))
      .sort((left, right) => right.value.length - left.value.length);

    return contained[0] ?? DocumentType.UNKNOWN;
  }
}
