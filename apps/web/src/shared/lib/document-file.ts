/**
 * What file the store will take, stated once.
 *
 * In `shared/` beside the transport that sends it (`api/upload`) rather than with
 * one of the surfaces that offers a picker, because more than one does — the
 * panel that adds a batch to a package, the intake screen that fills a new one,
 * and the button that sends a document in for a published gap (COMM-81) — and
 * every one of them has to refuse the same file. A second copy of these numbers
 * is a screen that accepts what `documents/presign` then declines.
 *
 * The workbook import is deliberately not here: `features/import-registry` reads
 * `.xlsx` at a different ceiling, and calling that the same rule because it also
 * takes a file would be the copy this file exists to avoid.
 */

/** What a document file is, as a picker row draws it. */
export type FileKind = 'pdf' | 'image';

// Kept in step with two rules outside this app: `FileSize.MAX_BYTES` in the
// verification context, which refuses to sign a presign for anything larger,
// and `client_max_body_size` in nginx.conf, which is what actually stops the
// bytes — below it the browser gets a 413 the app never sees coming.
export const MAX_MB = 50;
export const MAX_BYTES = MAX_MB * 1024 * 1024;
export const ACCEPT =
  '.pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png';

export function fileKind(name: string): FileKind | null {
  const ext = name.split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'pdf';
  if (ext === 'jpg' || ext === 'jpeg' || ext === 'png') return 'image';
  return null;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}
