import type { WorkbookShape } from '../../domain/index.js';

/**
 * Which of the archive's registers an uploaded workbook is.
 *
 * A port because there are two ways to answer it and the point is to compare
 * them. The register's own rule scores the file's sheet names and headers
 * against the catalogue; a model reads the same shape and says which register it
 * recognises, which is what an operator actually needs when a settlement sends a
 * file with its sheets renamed and a column added. Neither is trusted over the
 * other blind: a model that names a register the catalogue does not carry is
 * answered with the rule's answer, and the report says which of the two decided
 * (ADR-0012 §3).
 *
 * The classifier is shown a shape and never a record. Sheet names and header
 * rows are how a file is recognised; the rows under them are somebody's property
 * data, and sending them to a provider to be told what file this is would be
 * sending them for nothing (ADR-0008).
 */
export type WorkbookClassification = {
  /**
   * The id of the register in the catalogue, or null when the workbook is none
   * of them. Null is an answer: a file the register cannot recognise is refused
   * whole rather than read as a guess.
   */
  readonly register: string | null;
  /** 0 to 1, as the answerer means it. Null where it does not offer one. */
  readonly confidence: number | null;
  /** One line, in English, for the report. Never quotes a cell. */
  readonly reason: string;
  /** Who decided. `fingerprint` is the rule, `model` is the model. */
  readonly by: 'fingerprint' | 'model';
};

export abstract class WorkbookClassifier {
  abstract classify(shape: WorkbookShape): Promise<WorkbookClassification>;
}
