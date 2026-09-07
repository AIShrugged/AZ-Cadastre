import { Inject, Injectable } from '@nestjs/common';

import { Logger } from '@cadastre/logger';

import {
  WorkbookClassifier,
  type WorkbookClassification,
} from '../../application/ports/index.js';
import {
  readableShare,
  RECOGNISED,
  scoreRegisters,
  type WorkbookShape,
} from '../../domain/index.js';

/**
 * Which archive register a workbook is, decided by the rule and nothing else.
 *
 * The default, and the stand-in the model-backed classifier is checked against:
 * both are asked the same question about the same shape, and a run with
 * `WORKBOOK_CLASSIFIER_PROVIDER=openrouter` is a run whose answer can be
 * compared with this one (ADR-0012 §3). It needs no API key and no network,
 * which is why the whole import path works offline.
 *
 * It answers on sheet names and header spellings that have actually been seen.
 * That is its limit and the reason the other adapter exists: a settlement that
 * renamed `Sheet1` and added a column is a file this cannot place and a model
 * can.
 */
@Injectable()
export class FingerprintWorkbookClassifier extends WorkbookClassifier {
  private readonly logger: Logger;

  constructor(@Inject(Logger) logger: Logger) {
    super();
    this.logger = logger.child({ scope: FingerprintWorkbookClassifier.name });
  }

  async classify(shape: WorkbookShape): Promise<WorkbookClassification> {
    return fingerprint(shape, this.logger);
  }
}

/**
 * Shared with the model-backed adapter, which falls back to it: a model that
 * named a register the catalogue does not carry has not answered, and the rule's
 * answer is better than none.
 */
export function fingerprint(
  shape: WorkbookShape,
  logger: Logger,
): WorkbookClassification {
  const scores = scoreRegisters(shape);
  const [best] = scores;
  const readable = readableShare(shape);

  // Sheet names and header spellings only. What the file holds under them is
  // somebody's property data and has no part in recognising the file (ADR-0008).
  logger.debug('Workbook shape scored', {
    sheets: shape.sheets.length,
    readable: round(readable),
    scores: scores.map(score => ({
      register: score.register.id,
      score: round(score.score),
      matchedSheets: score.sheets.length,
      matchedMarkers: score.markers.length,
    })),
  });

  if (!best || best.score < RECOGNISED) {
    return {
      register: null,
      confidence: best ? round(best.score) : 0,
      reason: best
        ? `Its closest match is ${best.register.id}, and at ${percent(best.score)} of that register's ` +
          'sheet names and column headers it is not close enough to name.'
        : 'The register carries no catalogue to match it against.',
      by: 'fingerprint',
    };
  }

  return {
    register: best.register.id,
    confidence: round(best.score),
    reason:
      `${best.sheets.length} of its sheet names and ${best.markers.length} of ` +
      `the column headers only ${best.register.id} carries. ` +
      `${percent(readable)} of its columns are ones the register can read.`,
    by: 'fingerprint',
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}
