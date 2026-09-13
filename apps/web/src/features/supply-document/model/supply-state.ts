/**
 * What has already been sent in against a gap, and what became of it.
 *
 * A gap that is still open after a file was sent for it is the one case an
 * operator cannot read off the row alone: they attached something, the row did
 * not go away, and without a word here the only honest conclusion available to
 * them is that the button is broken. Two answers close that, and the package
 * publishes both.
 *
 *  - **Still being read.** The file is in the package, carrying the target it was
 *    sent with, and nothing has placed it yet. The row says so instead of sitting
 *    there unchanged (COMM-81).
 *  - **Refused.** The run placed it and it was not the paper it was sent in as,
 *    so the gap stayed open and the report carries `WrongDocumentSupplied`. The
 *    row says what was expected and what turned up, because the operator's next
 *    move depends on which of the two went wrong — the wrong file picked, or the
 *    right file misread.
 *
 * Both are read off what the server published. Nothing here decides whether a
 * supply was accepted: a supply that *was* accepted takes its gap off the list,
 * and the list is the server's (COMM-80).
 */
import type {
  DocumentGapDto,
  PackageDetailDto,
  SourceFileDto,
  SuppliedForDto,
} from '@cadastre/api-contracts/verification';

/** One file sent in for a gap, named as the operator named it. */
export type SuppliedFile = {
  readonly fileId: string;
  readonly filename: string;
  /** What the run placed it as, on a file that was refused. Null where the
   *  reader could not place it under any type this profile expects. */
  readonly arrivedType: string | null;
};

export type SupplyState = {
  /** Sent, and nothing has read it yet. */
  readonly reading: readonly SuppliedFile[];
  /** Sent, read, and not the paper it was sent in as. */
  readonly refused: readonly SuppliedFile[];
};

/** Whether this file was sent in for this very gap — the same type, and the same
 *  document replaced or no document at all. Type alone is not enough: a profile
 *  asking for two of a kind publishes an `UnusableScan` per document. */
function answers(target: SuppliedForDto | null, gap: DocumentGapDto): boolean {
  return (
    target !== null &&
    target.expectedType === gap.expectedType &&
    target.replacesDocumentId === gap.documentId
  );
}

/** Nothing has been carved out of the file yet, or what was carved has not been
 *  placed. Either way the run has not answered, and the same reading the engine
 *  takes before it files a refusal. */
function stillReading(file: SourceFileDto): boolean {
  return (
    file.documents.length === 0 ||
    file.documents.some(document => document.type === null)
  );
}

export function supplyStateFor(
  pkg: PackageDetailDto,
  gap: DocumentGapDto,
): SupplyState {
  const sent = pkg.files.filter(file => answers(file.suppliedFor, gap));
  const refusedFiles = new Set(
    (pkg.report?.issues ?? [])
      .filter(issue => issue.kind === 'WrongDocumentSupplied')
      .map(issue => issue.sourceFileId),
  );

  const named = (file: SourceFileDto): SuppliedFile => ({
    fileId: file.id,
    filename: file.originalFilename,
    // The first paper the reader made of the file, which is the one the finding
    // is filed against and the one the operator opens to see what they attached.
    arrivedType: file.documents[0]?.type ?? null,
  });

  return {
    reading: sent.filter(stillReading).map(named),
    refused: sent
      .filter(file => !stillReading(file) && refusedFiles.has(file.id))
      .map(named),
  };
}
