import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";

import {
  OCRProvider,
  type OcrPageInput,
  type OcrPageResult,
} from "../../application/ports/ocr-provider.port.js";
import { ObjectStorage } from "../../application/ports/object-storage.port.js";
import type { Environment } from "../config/env.shema.js";

const OCR_PROMPT =
  "You are an OCR engine. Transcribe ALL text visible in this document image " +
  "exactly, preserving line breaks and reading order. Output only the " +
  "transcribed text — no commentary, labels, or markdown.";

/**
 * Real OCR via OpenRouter (OpenAI-compatible). Pulls the page image's bytes from
 * object storage, sends them to a vision model as a data URL, and returns the
 * transcription. Selected when OCR_PROVIDER=openrouter; the mock stays the
 * default. Chat models don't report a calibrated confidence, so we record a
 * fixed nominal value.
 */
@Injectable()
export class OpenRouterOcrAdapter extends OCRProvider {
  private readonly logger = new Logger(OpenRouterOcrAdapter.name);
  private readonly client: OpenAI;
  private readonly model: string;
  private static readonly NOMINAL_CONFIDENCE = 0.9;

  constructor(
    config: ConfigService<Environment, true>,
    private readonly storage: ObjectStorage,
  ) {
    super();
    const openrouter = config.get("openrouter", { infer: true });
    if (!openrouter.apiKey) {
      throw new Error(
        "OCR_PROVIDER=openrouter requires OPENROUTER_API_KEY to be set",
      );
    }
    this.model = config.get("ocr", { infer: true }).model;
    this.client = new OpenAI({
      apiKey: openrouter.apiKey,
      baseURL: openrouter.baseUrl,
      defaultHeaders: { "X-Title": openrouter.appTitle },
    });
  }

  async recognize(input: OcrPageInput): Promise<OcrPageResult> {
    const object = await this.storage.getObject(input.imageStorageKey);
    const mime = input.contentType || object.contentType || "image/png";
    const dataUrl = `data:${mime};base64,${Buffer.from(object.body).toString("base64")}`;

    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: OCR_PROMPT },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
    });

    const text = completion.choices[0]?.message?.content?.trim() ?? "";
    this.logger.log(
      `OCR ${input.imageStorageKey} via ${this.model}: ${text.length} chars`,
    );
    return { text, confidence: OpenRouterOcrAdapter.NOMINAL_CONFIDENCE };
  }
}
