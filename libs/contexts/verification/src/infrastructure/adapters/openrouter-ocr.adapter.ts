import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";

import {
  ObjectStorage,
  OcrProvider,
} from "../../application/ports/index.js";
import {
  Confidence,
  OcrResult,
  type PageImage,
  RecognisedText,
} from "../../domain/value-objects/index.js";
import type { Environment } from "../config/index.js";
import { MissingOpenRouterApiKeyException } from "../exceptions/index.js";
import { confidenceFromLogprobs } from "./logprob-confidence.js";

const OCR_PROMPT =
  "You are an OCR engine. Transcribe ALL text visible in this document image " +
  "exactly, preserving line breaks and reading order. Output only the " +
  "transcribed text — no commentary, labels, or markdown.";

@Injectable()
export class OpenRouterOcrAdapter extends OcrProvider {
  private readonly logger = new Logger(OpenRouterOcrAdapter.name);
  private readonly client: OpenAI;
  private readonly model: string;
  override readonly pagesAtOnce: number;
  private static readonly NOMINAL_CONFIDENCE = 0.9;

  constructor(
    config: ConfigService<Environment, true>,
    private readonly storage: ObjectStorage,
  ) {
    super();
    const openrouter = config.get("openrouter", { infer: true });
    if (!openrouter.apiKey) {
      throw new MissingOpenRouterApiKeyException("OCR_PROVIDER");
    }
    const ocr = config.get("ocr", { infer: true });
    this.model = ocr.model;
    this.pagesAtOnce = ocr.concurrency;
    this.client = new OpenAI({
      apiKey: openrouter.apiKey,
      baseURL: openrouter.baseUrl,
      defaultHeaders: { "X-Title": openrouter.appTitle },
    });
  }

  async recognise(image: PageImage): Promise<OcrResult> {
    const object = await this.storage.getObject(image.storageKey);
    const mime = image.contentType.value;
    const dataUrl = `data:${mime};base64,${Buffer.from(object.body).toString("base64")}`;

    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      logprobs: true,
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
    const confidence =
      confidenceFromLogprobs(completion) ??
      OpenRouterOcrAdapter.NOMINAL_CONFIDENCE;
    this.logger.log(
      `OCR ${image.storageKey.value} via ${this.model}: ${text.length} chars, confidence ${confidence.toFixed(3)}`,
    );

    return text.length === 0
      ? OcrResult.illegible()
      : OcrResult.of(RecognisedText.of(text), Confidence.of(confidence));
  }
}
