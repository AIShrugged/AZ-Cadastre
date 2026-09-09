/**
 * One import, from the first byte to the last thing it leaves behind.
 *
 * The modal used to hold this inline, and holding it there hid the half of the
 * work that is not the modal's: a workbook the register accepted has changed
 * what the archive holds, and the sidebar's band is still showing the count
 * from before it. The band asks on a two-minute poll (COMM-59), so an operator
 * who has just read "records imported" sees the old figures beside it for up to
 * two minutes — which reads as the import not having worked.
 *
 * So the run says so. It is here and not in the component because the outcome
 * rule — which of the three endings refreshes the archive — is the part worth
 * testing, and a component cannot be tested in this app's unit set (TECH_DEBT
 * §3). The transfer itself stays where it was, in `../api/registry-import-api`.
 */
import axios from 'axios';

import { archiveHoldingsChanged } from '@/entities/archive-record';
import { apiFailure } from '@/shared/api';
import type { AppDispatch } from '@/shared/lib/store-hooks';

import { importRegistryWorkbook } from '../api/registry-import-api';

import type { ImportPhase } from './types';

export type ImportRun = {
  /** Where the run has got to, as the modal should show it. */
  onPhase: (phase: ImportPhase) => void;
  dispatch: AppDispatch;
  signal: AbortSignal;
  /**
   * What to say about a register that never answered at all. The modal's own
   * wording, translated there: this module has no locale.
   */
  unreachable: string;
};

/**
 * Send one workbook, report what the register did with it, and — only if it did
 * anything — tell the store the archive has moved.
 *
 * Three endings, and only one of them touches the cache:
 *
 * - **the register reported.** It read the workbook and wrote what it could,
 *   whether or not it took every object in it: a partly-refused book is still
 *   rows the archive did not have a minute ago, so the band has to re-ask. The
 *   report on screen is the operator's evidence; stale figures beside it would
 *   contradict it.
 * - **cancelled.** The modal aborts its own transfer when it closes. Nothing
 *   was reported, and the register upserts on the object key, so there is
 *   nothing to forget.
 * - **failed.** No report means the register stored nothing it told us about;
 *   re-asking would spend a call to be told the same figures.
 */
export async function runImport(
  file: File,
  { onPhase, dispatch, signal, unreachable }: ImportRun,
): Promise<void> {
  onPhase({ kind: 'sending', progress: 0 });

  try {
    const report = await importRegistryWorkbook(file, {
      signal,
      onProgress: progress => onPhase({ kind: 'sending', progress }),
    });
    onPhase({ kind: 'reported', report });
    dispatch(archiveHoldingsChanged());
  } catch (error) {
    // The modal aborts its own transfer when it closes — that is not a failure,
    // and the modal it belonged to is gone, so there is no phase to set either.
    if (axios.isCancel(error)) return;
    // The register answers a refusal in the published `ErrorBody`, but with one
    // code for all of them (`VALIDATION_FAILED`) — so unlike the core API there
    // is nothing to key a translation on, and its sentence names the actual
    // fault. Shown as it came; the fallback covers a register that never
    // answered at all.
    onPhase({
      kind: 'failed',
      message: apiFailure(error)?.message ?? unreachable,
    });
  }
}
