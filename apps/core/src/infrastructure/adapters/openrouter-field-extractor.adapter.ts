import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";

import {
  FieldExtractor,
  type ExtractInput,
  type ExtractedFieldValue,
} from "../../application/ports/field-extractor.port.js";
import type { Environment } from "../config/env.shema.js";

const MAX_TEXT = 8000;

/**
 * Real field extractor via OpenRouter (OpenAI-compatible). Asks an LLM to pull
 * the schema's fields out of the OCR text and return them as JSON — works across
 * languages and layouts, unlike a regex mock. Selected when
 * EXTRACTOR_PROVIDER=openrouter. The model reports no calibrated per-field
 * confidence, so found values get a fixed nominal value.
 */
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
      throw new Error(
        "EXTRACTOR_PROVIDER=openrouter requires OPENROUTER_API_KEY to be set",
      );
    }
    this.model = config.get("extractor", { infer: true }).model;
    this.client = new OpenAI({
      apiKey: openrouter.apiKey,
      baseURL: openrouter.baseUrl,
      defaultHeaders: { "X-Title": openrouter.appTitle },
    });
  }

  async extract(input: ExtractInput): Promise<ExtractedFieldValue[]> {
    const schema = input.fields
      .map((f) => `- ${f.key}: ${f.label}`)
      .join("\n");

    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            `Extract the following fields from the OCR text of a ${input.documentType}. ` +
            "Return a JSON object mapping each field key to its value as a string, " +
            "or null if the value is not present. Transcribe values exactly (names " +
            "may be in any script). Use ONLY these keys:\n" +
            schema,
        },
        { role: "user", content: input.text.slice(0, MAX_TEXT) },
      ],
    });

    const raw = completion.choices[0]?.message?.content ?? "{}";
    const parsed = this.parse(raw);

    const results = input.fields.flatMap((spec): ExtractedFieldValue[] => {
      const value = parsed[spec.key];
      if (value === null || value === undefined || String(value).trim() === "") {
        return [];
      }
      return [
        {
          name: spec.key,
          value: String(value).trim(),
          confidence: OpenRouterFieldExtractorAdapter.NOMINAL_CONFIDENCE,
          pageNumber: 1,
        },
      ];
    });
    this.logger.log(
      `Extracted ${results.length}/${input.fields.length} fields from ${input.documentType}`,
    );
    return results;
  }

  /** Parse the model's JSON, tolerating stray prose around the object. */
  private parse(raw: string): Record<string, unknown> {
    try {
      return JSON.parse(raw) as Record<string, unknown>;
    } catch {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          return JSON.parse(match[0]) as Record<string, unknown>;
        } catch {
          /* fall through */
        }
      }
      this.logger.warn(`Could not parse extractor JSON: ${raw.slice(0, 120)}`);
      return {};
    }
  }
}
