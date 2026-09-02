import { Inject, Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { z } from 'zod';

import { Logger } from '@cadastre/logger';

import {
  DocumentSegmenter,
  type ReadPage,
  type SegmentationRequest,
} from '../../../application/ports/outbound/index.js';
import { BLANK_PAGE, tileIntoRanges } from '../../../domain/services/index.js';
import {
  DocumentCatalogue,
  type DocumentTypeSpec,
  type PageRange,
} from '../../../domain/value-objects/index.js';
import {
  VERIFICATION_OPTIONS,
  type VerificationModuleOptions,
} from '../../../verification.module-defs.js';
import { MissingOpenRouterApiKeyException } from '../../exceptions/index.js';

import { answerOf } from './answered.js';
import { telemetryOf } from './telemetry.js';

// Enough of a sheet to tell a title page from a continuation, without paying
// for the body of a long file twice over.
const MAX_HEAD_PER_PAGE = 900;

// And enough of its foot to catch what a title alone cannot say. The drawing
// sets in these packages number themselves only in the title block at the
// bottom right — "Vərəq 3 / Vərəqlər 6" — which is the plainest statement of
// "this sheet continues the last one" anywhere in the file, and head-only
// truncation threw it away.
const MAX_TAIL_PER_PAGE = 320;

// A package is not only what the profile requires of it. These arrive in the
// same envelope, and a segmenter with no word for them runs them together into
// one shapeless block — three separate service sheets read as a single
// document, which is what happened before they were named here. Naming them
// costs nothing and it is the classifier, not this stage, that decides they are
// out of profile.
//
// The list is the document catalogue's own (ADR-0012): the stage that has to
// see these sheets apart and the stage that names them read from one place, so
// a paper added to the catalogue cannot end up known to only one of them.
const ALSO_EXPECTED = DocumentCatalogue.KNOWN.entries.map(entry =>
  [
    entry.description,
    `Usually headed: ${entry.hints.map(hint => `"${hint}"`).join(', ')}.`,
  ].join(' '),
);

const AnswerSchema = z.object({
  documents: z
    .array(
      z.object({
        start: z.number(),
        label: z.string().default(''),
        confidence: z.number().min(0).max(1).nullish(),
      }),
    )
    .default([]),
});

// One call over the head and foot of every sheet in a file.
const SEGMENTATION_TIMEOUT_MS = 120_000;

@Injectable()
export class OpenRouterSegmenterAdapter extends DocumentSegmenter {
  private readonly logger: Logger;
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(
    @Inject(VERIFICATION_OPTIONS) options: VerificationModuleOptions,
    @Inject(Logger) logger: Logger,
  ) {
    super();
    const openrouter = options.openrouter;
    if (!openrouter.apiKey) {
      throw new MissingOpenRouterApiKeyException('SEGMENTER_PROVIDER');
    }
    this.model = options.segmenter.model;
    this.logger = logger.child({
      scope: OpenRouterSegmenterAdapter.name,
      model: this.model,
    });
    this.client = new OpenAI({
      apiKey: openrouter.apiKey,
      baseURL: openrouter.baseUrl,
      defaultHeaders: { 'X-Title': openrouter.appTitle },
      // A page the provider never answers about must not hold the pipeline
      // open: without these the SDK waits ten minutes and then retries twice,
      // so one stuck sheet can cost half an hour of a run that has already read
      // everything else. The per-sheet retry in the use case does the asking
      // again; this only bounds one ask.
      timeout: SEGMENTATION_TIMEOUT_MS,
      maxRetries: 1,
    });
  }

  async segment(request: SegmentationRequest): Promise<readonly PageRange[]> {
    const pageCount = request.pages.length;
    const startedAt = Date.now();

    this.logger.debug('Asking where the documents in this file begin', {
      sheets: pageCount,
      // A sheet the reader could not transcribe is a sheet this stage decides
      // about blind, and that is where a run of them gets read as one.
      unread: request.pages.filter(page => page.text.value.length === 0).length,
      candidates: request.candidates.map(candidate => candidate.type.value),
    });

    const completion = await this.client.chat.completions.create({
      model: this.model,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: this.instructions(request.candidates) },
        { role: 'user', content: this.transcript(request.pages) },
      ],
    });

    const found = this.parse(
      answerOf(this.model, completion).message?.content ?? '',
    );
    const ranges = tileIntoRanges(
      found.map(document => document.start),
      pageCount,
    );

    this.logger.log(
      found.length === 0
        ? 'The model named no boundary, so the file is taken whole'
        : 'File read into documents',
      {
        sheets: pageCount,
        documents: ranges.length,
        // The labels are the model's own words for what it thinks it found.
        // They are not used anywhere — the classifier decides that — but they
        // are what makes a wrong boundary obvious at a glance.
        boundaries: found.map(document => ({
          startsAt: document.start,
          label: document.label || '?',
          confidence: document.confidence ?? null,
        })),
        durationMs: Date.now() - startedAt,
        ...telemetryOf(completion),
      },
    );

    return ranges;
  }

  private instructions(candidates: readonly DocumentTypeSpec[]): string {
    return [
      'You are given the transcribed text of every sheet of ONE scanned file',
      'submitted to the Azerbaijani real estate registration authority, in order.',
      '',
      'The file is a container: it may hold one document or several back to',
      'back, and a single document may run over several sheets. Decide which',
      'sheets START a new document.',
      '',
      'A sheet starts a new document when it opens a different record — a new',
      'heading, a different issuing body, a new form or licence number, a fresh',
      'set of signatures and stamps. A sheet CONTINUES the previous document',
      'when it carries on its table, clauses or drawings, repeats its number in',
      "a header or footer, or numbers itself as one sheet of that document's set",
      '(e.g. "Vərəq 3 / Vərəqlər 6" in a drawing title block).',
      '',
      'Documents the profile expects in this file:',
      '',
      ...candidates.map(
        candidate => `- ${candidate.type.value}: ${candidate.description}`,
      ),
      '',
      'Also commonly present, and each a document of its own — do not run them',
      'together with their neighbours just because the profile does not ask for',
      'them:',
      '',
      ...ALSO_EXPECTED.map(description => `- ${description}`),
      '',
      'Two documents of the SAME kind can sit back to back — two separate',
      'licences, or two extracts from two different orders. Start a new one',
      'whenever the record itself changes, not only when the kind does.',
      '',
      `A sheet transcribed as "${BLANK_PAGE}" is the back of the sheet before it.`,
      'It CONTINUES that document and never starts one.',
      '',
      'The text is usually Azerbaijani (Latin script), sometimes Azerbaijani in',
      'Cyrillic script, sometimes Russian; transcription may have mangled',
      'headings. Handwriting is marked [hw: ...] and stamps [stamp: ...].',
      'Sheet 1 always starts a document.',
      '',
      // The word "JSON" is load-bearing: OpenAI refuses `response_format:
      // json_object` outright — 400, no completion — unless the conversation
      // says it somewhere.
      'Reply with ONLY this JSON object:',
      '{"documents":[{"start":<sheet number>,"label":"<what it appears to be, a few words>",',
      '"confidence":<0..1, how sure you are this sheet starts a document>}]}',
    ].join('\n');
  }

  // Head and tail of each sheet, with the middle dropped: a document announces
  // itself at the top and numbers itself at the bottom, and the body between
  // them is what the classifier reads, not this stage.
  private transcript(pages: readonly ReadPage[]): string {
    return pages
      .map(page => {
        const text = page.text.value;
        const body =
          text.length <= MAX_HEAD_PER_PAGE + MAX_TAIL_PER_PAGE
            ? text
            : `${text.slice(0, MAX_HEAD_PER_PAGE)}\n […] \n${text.slice(-MAX_TAIL_PER_PAGE)}`;

        return `--- SHEET ${page.number.value} ---\n${body}`;
      })
      .join('\n\n');
  }

  // A file the model answers nonsense about is still one document per sheet
  // boundary it did name; `tileIntoRanges` turns an empty answer into the whole
  // file as a single document, which is the safe reading.
  private parse(
    raw: string,
  ): readonly { start: number; label: string; confidence?: number | null }[] {
    const json = raw.match(/\{[\s\S]*\}/)?.[0] ?? raw;
    const parsed = AnswerSchema.safeParse(this.json(json));

    if (!parsed.success) {
      this.logger.warn("Could not read the segmenter's JSON", {
        answered: raw.slice(0, 200),
      });
      return [];
    }

    return parsed.data.documents;
  }

  private json(raw: string): unknown {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}
