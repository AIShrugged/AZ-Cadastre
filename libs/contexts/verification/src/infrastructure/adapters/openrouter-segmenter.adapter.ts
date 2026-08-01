import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import OpenAI from "openai";
import { z } from "zod";

import {
  DocumentSegmenter,
  type ReadPage,
  type SegmentationRequest,
} from "../../application/ports/index.js";
import type {
  DocumentTypeSpec,
  PageRange,
} from "../../domain/value-objects/index.js";
import type { Environment } from "../config/index.js";
import { MissingOpenRouterApiKeyException } from "../exceptions/index.js";
import { tileIntoRanges } from "./page-range-tiling.js";

// Enough of a sheet to tell a title page from a continuation, without paying
// for the body of a long file twice over.
const MAX_TEXT_PER_PAGE = 1200;

const AnswerSchema = z.object({
  starts: z.array(z.number()).default([]),
});

@Injectable()
export class OpenRouterSegmenterAdapter extends DocumentSegmenter {
  private readonly logger = new Logger(OpenRouterSegmenterAdapter.name);
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(config: ConfigService<Environment, true>) {
    super();
    const openrouter = config.get("openrouter", { infer: true });
    if (!openrouter.apiKey) {
      throw new MissingOpenRouterApiKeyException("SEGMENTER_PROVIDER");
    }
    this.model = config.get("segmenter", { infer: true }).model;
    this.client = new OpenAI({
      apiKey: openrouter.apiKey,
      baseURL: openrouter.baseUrl,
      defaultHeaders: { "X-Title": openrouter.appTitle },
    });
  }

  async segment(request: SegmentationRequest): Promise<readonly PageRange[]> {
    const pageCount = request.pages.length;

    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: this.instructions(request.candidates) },
        { role: "user", content: this.transcript(request.pages) },
      ],
    });

    const starts = this.parse(completion.choices[0]?.message?.content ?? "");
    const ranges = tileIntoRanges(starts, pageCount);

    this.logger.log(
      `Read ${pageCount} sheet(s) as ${ranges.length} document(s) ` +
        `(model said ${JSON.stringify(starts)})`,
    );

    return ranges;
  }

  private instructions(candidates: readonly DocumentTypeSpec[]): string {
    return [
      "You are given the OCR text of every sheet of ONE scanned file submitted",
      "to the Azerbaijani real estate registration authority, in order.",
      "",
      "The file is a container: it may hold one document or several back to",
      "back, and a single document may run over several sheets. Decide which",
      "sheets START a new document.",
      "",
      "A sheet starts a new document when it opens a different record — a new",
      "heading, a different issuing body, a new form or licence number, a fresh",
      "set of signatures and stamps. A sheet CONTINUES the previous document",
      "when it carries on its table, clauses or drawings, repeats its number in",
      "a header or footer, or is numbered as its page 2 of N.",
      "",
      "Documents of these kinds are expected in this file:",
      "",
      ...candidates.map(
        (candidate) => `- ${candidate.type.value}: ${candidate.description}`,
      ),
      "",
      "Two documents of the SAME kind can sit back to back — two separate",
      "licences, say. Start a new one whenever the record itself changes, not",
      "only when the kind does.",
      "",
      "The text is usually Azerbaijani (Latin script), sometimes Russian, and",
      "OCR may have mangled headings. Sheet 1 always starts a document.",
      "",
      'Reply with ONLY {"starts": [<sheet numbers>]} — no other words.',
    ].join("\n");
  }

  private transcript(pages: readonly ReadPage[]): string {
    return pages
      .map(
        (page) =>
          `--- SHEET ${page.number.value} ---\n` +
          page.text.value.slice(0, MAX_TEXT_PER_PAGE),
      )
      .join("\n\n");
  }

  // A file the model answers nonsense about is still one document per sheet
  // boundary it did name; `tileIntoRanges` turns an empty answer into the whole
  // file as a single document, which is the safe reading.
  private parse(raw: string): readonly number[] {
    const json = raw.match(/\{[\s\S]*\}/)?.[0] ?? raw;
    const parsed = AnswerSchema.safeParse(this.json(json));

    if (!parsed.success) {
      this.logger.warn(`Could not read segmenter JSON: ${raw.slice(0, 120)}`);
      return [];
    }

    return parsed.data.starts;
  }

  private json(raw: string): unknown {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}
