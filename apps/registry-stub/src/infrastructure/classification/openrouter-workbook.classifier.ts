import { Inject, Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { z } from 'zod';

import { Logger } from '@cadastre/logger';

import {
  WorkbookClassifier,
  type WorkbookClassification,
} from '../../application/ports/index.js';
import { REGISTRY_OPTIONS, type RegistryOptions } from '../../config/index.js';
import {
  ARCHIVE_REGISTERS,
  registerNamed,
  type WorkbookShape,
} from '../../domain/index.js';

import { fingerprint } from './fingerprint-workbook.classifier.js';

const AnswerSchema = z.object({
  register: z.string().nullish(),
  confidence: z.number().min(0).max(1).nullish(),
  reason: z.string().nullish(),
});

/**
 * One workbook's shape and one short answer. Without a bound the SDK waits ten
 * minutes and retries twice, and an operator watching an upload spinner is not
 * going to wait half an hour to be told what file they sent.
 */
const CLASSIFICATION_TIMEOUT_MS = 60_000;

/**
 * How many header rows and how many columns of each sheet the model is shown.
 *
 * Enough to recognise a register and no more. `EMDK` has twenty-four sheets of
 * twenty-six columns, and a prompt carrying all of it would cost more than the
 * question is worth without saying anything the first dozen columns do not.
 */
const MAX_SHEETS = 40;
const MAX_COLUMNS = 16;

/**
 * Asks a model which of the archive's registers a workbook is.
 *
 * This is why the port exists. The fingerprint answers on spellings that have
 * been seen; the files that will actually arrive are fifty-five of them from
 * offices that renamed a sheet, added a column and saved it in a different code
 * page, and recognising those from a family resemblance is what a model is for
 * (ADR-0012 §3).
 *
 * It is not trusted blind. The model may only name a register the catalogue
 * carries — anything else, and the rule's answer stands — and the report says
 * which of the two decided, so an operator is never told a file is something on
 * nobody's authority.
 *
 * It is shown the shape and never a record: sheet names and header rows are how
 * a file is recognised, and sending somebody's property data to a provider to be
 * told what file this is would be sending it for nothing (ADR-0008).
 */
@Injectable()
export class OpenRouterWorkbookClassifier extends WorkbookClassifier {
  private readonly logger: Logger;
  private readonly client: OpenAI;
  private readonly model: string;

  constructor(
    @Inject(REGISTRY_OPTIONS) options: RegistryOptions,
    @Inject(Logger) logger: Logger,
  ) {
    super();

    const { openrouter, classifier } = options;

    if (!openrouter.apiKey) {
      throw new Error(
        'WORKBOOK_CLASSIFIER_PROVIDER=openrouter needs OPENROUTER_API_KEY. ' +
          'Unset it to classify uploaded register files by the rule instead, ' +
          'which needs no key and no network.',
      );
    }

    this.model = classifier.model;
    this.logger = logger.child({
      scope: OpenRouterWorkbookClassifier.name,
      model: this.model,
    });
    this.client = new OpenAI({
      apiKey: openrouter.apiKey,
      baseURL: openrouter.baseUrl,
      defaultHeaders: { 'X-Title': openrouter.appTitle },
      timeout: CLASSIFICATION_TIMEOUT_MS,
      maxRetries: 1,
    });
  }

  async classify(shape: WorkbookShape): Promise<WorkbookClassification> {
    const rule = fingerprint(shape, this.logger);
    const startedAt = Date.now();

    this.logger.debug('Asking which archive register this workbook is', {
      sheets: shape.sheets.length,
      candidates: ARCHIVE_REGISTERS.map(register => register.id),
    });

    let answer: z.infer<typeof AnswerSchema> | null = null;
    let raw = '';

    try {
      const completion = await this.client.chat.completions.create({
        model: this.model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: instructions() },
          { role: 'user', content: describe(shape) },
        ],
      });

      raw = completion?.choices?.[0]?.message?.content?.trim() ?? '';
      answer = parse(raw);
    } catch (error) {
      // A provider that is down is not a file the register cannot read. The
      // rule already has an answer and it is the one an operator gets, said as
      // the rule's rather than as the model's.
      this.logger.warn(
        'The classifier could not be reached; the rule answered',
        {
          error: error instanceof Error ? error.name : 'unknown',
          durationMs: Date.now() - startedAt,
        },
      );

      return rule;
    }

    const named = answer?.register ?? null;
    const known = named && named !== 'none' ? registerNamed(named) : null;

    this.logger.log('Workbook classified', {
      // What the model answered, beside what that was read as: a register that
      // came back misspelled and one the catalogue does not carry look the same
      // in the result and are not the same problem.
      modelSaid: named ?? raw.slice(0, 40),
      register: known?.id ?? rule.register,
      agreed: (known?.id ?? null) === rule.register,
      ruleSaid: rule.register,
      confidence: answer?.confidence ?? null,
      durationMs: Date.now() - startedAt,
    });

    // `none` is an answer and the rule is not asked to overturn it: a model
    // that has read the shape and says it is none of the six has said more
    // than a fingerprint that scored 0.49.
    if (named === 'none') {
      return {
        register: null,
        confidence: answer?.confidence ?? null,
        reason:
          answer?.reason?.slice(0, 300) ??
          'The model recognised none of the archive registers in it.',
        by: 'model',
      };
    }

    if (!known) return rule;

    return {
      register: known.id,
      confidence: answer?.confidence ?? null,
      reason: answer?.reason?.slice(0, 300) ?? `Recognised as ${known.file}.`,
      by: 'model',
    };
  }
}

function parse(raw: string): z.infer<typeof AnswerSchema> | null {
  try {
    return AnswerSchema.parse(JSON.parse(raw));
  } catch {
    return null;
  }
}

function instructions(): string {
  const candidates = ARCHIVE_REGISTERS.map(
    register =>
      `- id "${register.id}" — ${register.file}. ${register.what} ` +
      `Sheets it is known to carry: ${register.sheets.join(', ')}.`,
  ).join('\n');

  return [
    'You are told the shape of an Excel workbook from the archive of the',
    'Azerbaijani immovable property register: its sheet names and its header',
    'rows. Each sheet heads its columns twice, once in Azerbaijani and once in',
    'English; some files are still in the Azerbaijani Cyrillic code page.',
    '',
    'Say which of these registers it is:',
    candidates,
    '',
    'Match on what the columns mean, not on the exact words: an office may have',
    'renamed a sheet, added a column or dropped one, and the file is still that',
    'register. Answer "none" only when it is none of them.',
    '',
    'Answer with JSON: {"register": "<id or none>", "confidence": <0..1>,',
    '"reason": "<one English sentence about the sheets and columns>"}.',
    'Never quote a cell value; you are not shown any.',
  ].join('\n');
}

/** The workbook's shape as one page of text. Sheet names and headers, no records. */
function describe(shape: WorkbookShape): string {
  return shape.sheets
    .slice(0, MAX_SHEETS)
    .map(sheet => {
      const headers = sheet.headers
        .map(row =>
          row
            .slice(0, MAX_COLUMNS)
            .map(header => header.trim())
            .filter(header => header !== '')
            .join(' | '),
        )
        .filter(row => row !== '')
        .map(row => `    ${row}`)
        .join('\n');

      return `  sheet "${sheet.name}" (${sheet.rows} data rows)\n${headers}`;
    })
    .join('\n');
}
