import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DomainException } from "@cadastre/kernel";
import OpenAI from "openai";

import {
  FieldExtractor,
  type ExtractionRequest,
} from "../../application/ports/index.js";
import { ExtractedField } from "../../domain/entities/index.js";
import {
  Confidence,
  type DocumentTypeSpec,
  FieldValue,
  PageNumber,
} from "../../domain/value-objects/index.js";
import type { Environment } from "../config/index.js";
import { MissingOpenRouterApiKeyException } from "../exceptions/index.js";
import { confidenceFromLogprobs } from "./logprob-confidence.js";

const MAX_TEXT = 8000;

@Injectable()
export class OpenRouterFieldExtractorAdapter extends FieldExtractor {
  private readonly logger = new Logger(OpenRouterFieldExtractorAdapter.name);
  private readonly client: OpenAI;
  private readonly model: string;
  private static readonly NOMINAL_CONFIDENCE = 0.9;

  constructor(config: ConfigService<Environment, true>) {
    super();
    const openrouter = config.get("openrouter", { infer: true });
    if (!openrouter.apiKey) {
      throw new MissingOpenRouterApiKeyException("EXTRACTOR_PROVIDER");
    }
    this.model = config.get("extractor", { infer: true }).model;
    this.client = new OpenAI({
      apiKey: openrouter.apiKey,
      baseURL: openrouter.baseUrl,
      defaultHeaders: { "X-Title": openrouter.appTitle },
    });
  }

  async extract(
    request: ExtractionRequest,
  ): Promise<readonly ExtractedField[]> {
    const specs = request.spec.schema.specs;

    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      logprobs: true,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: this.instructions(request.spec) },
        { role: "user", content: request.text.value.slice(0, MAX_TEXT) },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = this.parse(raw);

    // One response-level number for every field: per-field certainty would need
    // a token→value mapping the completion does not carry.
    const confidence =
      confidenceFromLogprobs(completion) ??
      OpenRouterFieldExtractorAdapter.NOMINAL_CONFIDENCE;

    const fields: ExtractedField[] = [];

    for (const spec of specs) {
      const answer = parsed[spec.key.value];
      if (answer === null || answer === undefined) continue;

      const value = String(answer).trim();
      if (value === "") continue;

      try {
        fields.push(
          ExtractedField.of(
            spec.key,
            FieldValue.create(value),
            Confidence.of(confidence),
            PageNumber.first(),
          ),
        );
      } catch (error) {
        // A model answer the domain refuses costs its own field, not the whole
        // extraction. Anything else is a fault of ours and travels on.
        if (!(error instanceof DomainException)) throw error;

        this.logger.warn(
          `Dropped field "${spec.key.value}": ${error.code} (${error.message})`,
        );
      }
    }

    this.logger.log(
      `Extracted ${fields.length}/${specs.length} fields from ${request.spec.type.value}`,
    );
    return fields;
  }

  private instructions(spec: DocumentTypeSpec): string {
    const schema = spec.schema.specs
      .map((field) => `- ${field.key.value}: ${field.label}`)
      .join("\n");

    return [
      "You read structured values off one scanned document submitted to the",
      "Azerbaijani real estate registration authority.",
      "",
      `The document is a ${spec.type.value}. ${spec.description}`,
      "",
      "Its text is usually Azerbaijani (Latin script), sometimes Russian or",
      "English, and OCR may have mangled letters and diacritics.",
      "",
      "Return a JSON object mapping each key below to its value as a string,",
      "or to null when the document does not carry that value. Use ONLY these",
      "keys:",
      schema,
      "",
      "Rules:",
      "- Transcribe values exactly as printed, in their own script. Do not",
      "  translate, transliterate or expand names and addresses.",
      "- Write every date as DD.MM.YYYY, whatever form it appears in.",
      "- A surname printed in capitals stays in capitals.",
      "- Give the value alone, without its printed label.",
      "- Never infer, compute or invent a value that is not on the document.",
      "  A null is worth more to the inspector than a plausible guess: they",
      "  check the ones we return.",
    ].join("\n");
  }

  private parse(raw: string): Record<string, unknown> {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]) as Record<string, unknown>;
        } catch {
          // fall through to the warning below
        }
      }
      this.logger.warn(`Could not parse extractor JSON: ${raw.slice(0, 120)}`);
      return {};
    }
  }
}
