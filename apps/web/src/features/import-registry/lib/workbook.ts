/**
 * What this surface refuses before the register is asked.
 *
 * Both rules are the register's, restated: `ImportController` reads the
 * extension rather than the media type — browsers and office tools disagree
 * about what an .xlsx is called — and refuses anything over 25 MB, because the
 * whole workbook is held in memory to be read (ADR-0011). Checking here saves
 * an upload that would be refused on arrival; the register still checks, and
 * whatever it says is what the modal shows.
 */

export const XLSX = '.xlsx';
export const ACCEPT =
  '.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export const MAX_MB = 25;
export const MAX_BYTES = MAX_MB * 1024 * 1024;

/** Why this file cannot be sent, or null when it can. */
export type WorkbookRefusal = 'format' | 'size';

export function refusalFor(file: File): WorkbookRefusal | null {
  if (!file.name.toLowerCase().endsWith(XLSX)) return 'format';
  if (file.size > MAX_BYTES) return 'size';
  return null;
}
