/**
 * Which of the archive's registers a workbook is, decided from its shape alone.
 *
 * The rule and not the model. It scores the sheet names and the column headers
 * a file carries against the catalogue and answers with every candidate and how
 * well each fits, so that the same question can be put to a model and the two
 * answers compared — which is what makes the model-backed classifier checkable
 * rather than merely believed (ADR-0012 §3).
 *
 * Nothing here reads a cell. A file's shape is its sheet names and its header
 * rows; the records under them are somebody's property data and are not part of
 * recognising the file.
 */
import {
  ARCHIVE_REGISTERS,
  foldSheet,
  type ArchiveRegister,
} from '../archive-registers/catalogue.js';
import { foldHeader, KNOWN_HEADERS } from '../archive-registers/header-lexicon.js'; // prettier-ignore

import type { WorkbookShape } from '../sheets.js';

export type RegisterScore = {
  readonly register: ArchiveRegister;
  /** 0 to 1. How much of this register's fingerprint the workbook carries. */
  readonly score: number;
  /** Sheet names of the workbook this register is known to carry. */
  readonly sheets: readonly string[];
  /** Marker headers of this register the workbook carries. */
  readonly markers: readonly string[];
};

/**
 * Sheet names weigh more than headers because they are the part an office
 * cannot rewrite without noticing: two of these files carry a sheet called
 * `Sheet1`, and the markers are what separate them.
 */
const SHEET_WEIGHT = 0.6;
const MARKER_WEIGHT = 0.4;

/**
 * A score below this is not an answer. Half the fingerprint present is a file
 * that shares some vocabulary with a register, which every one of them does —
 * they were written by offices that talked to each other.
 */
export const RECOGNISED = 0.5;

export function scoreRegisters(shape: WorkbookShape): readonly RegisterScore[] {
  const sheets = new Set(shape.sheets.map(sheet => foldSheet(sheet.name)));
  const headers = new Set(
    shape.sheets.flatMap(sheet =>
      sheet.headers.flatMap(row => row.map(cell => foldHeader(cell))),
    ),
  );

  return ARCHIVE_REGISTERS.map(register => {
    const matchedSheets = register.sheets.filter(name =>
      sheets.has(foldSheet(name)),
    );
    const matchedMarkers = register.markers.filter(marker =>
      headers.has(marker),
    );

    // Against what the workbook carries and not against what the register does:
    // an office that sent one sheet of its register sent a whole file of that
    // register, and scoring it against all twenty-four would sink it.
    const sheetShare = share(matchedSheets.length, Math.min(sheets.size, register.sheets.length)); // prettier-ignore
    const markerShare = share(matchedMarkers.length, register.markers.length);

    return {
      register,
      score: SHEET_WEIGHT * sheetShare + MARKER_WEIGHT * markerShare,
      sheets: matchedSheets,
      markers: matchedMarkers,
    };
  }).sort((a, b) => b.score - a.score);
}

/** The best-fitting register, or null when nothing fits well enough to name one. */
export function bestFit(shape: WorkbookShape): RegisterScore | null {
  const [best] = scoreRegisters(shape);

  return best && best.score >= RECOGNISED ? best : null;
}

/**
 * How much of the workbook's vocabulary the lexicon can read at all.
 *
 * Reported rather than acted on: a file the catalogue recognises but whose
 * columns are half unreadable is a register that has grown a column, and the
 * operator is the one who has to know.
 */
export function readableShare(shape: WorkbookShape): number {
  const columns = shape.sheets.flatMap(
    sheet =>
      sheet.headers[0]?.map((_, index) =>
        sheet.headers.map(row => row[index] ?? ''),
      ) ?? [],
  );
  const named = columns.filter(spellings =>
    spellings.some(spelling => spelling.trim() !== ''),
  );
  const read = named.filter(spellings =>
    spellings.some(spelling => KNOWN_HEADERS.has(foldHeader(spelling))),
  );

  return share(read.length, named.length);
}

function share(part: number, whole: number): number {
  return whole === 0 ? 0 : Math.min(1, part / whole);
}
