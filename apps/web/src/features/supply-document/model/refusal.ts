/**
 * What this surface refuses before the service is asked, and how a refusal that
 * still comes back is read to the operator.
 *
 * Two checks and no more: the format and the size, both rules that exist outside
 * this app — `documents/presign` will not sign a key for either — so refusing
 * here saves a round trip and says the same thing the service would. Everything
 * else is the server's to decide, including whether the paper is the one that was
 * asked for: nothing has read the file at the moment the button is pressed
 * (COMM-80).
 */
import { fileKind, MAX_BYTES } from '@/shared/lib/document-file';

/** Why this file cannot be sent at all, or null when it can. The keys are the
 *  ones the bulk panel's rows already use, so one refusal reads the same
 *  wherever a file is attached. */
export type LocalRefusal = 'format' | 'size';

export function localRefusal(file: File): LocalRefusal | null {
  if (fileKind(file.name) === null) return 'format';
  if (file.size > MAX_BYTES) return 'size';
  return null;
}

/**
 * The dictionary key a refusal is read under.
 *
 * A refusal the service named carries a stable `code` and is read by it — never
 * by its status, which cannot tell "that target is not on the list" from "this
 * package is busy", and never by its message, which is written for an audit log.
 * A transfer that broke without the service ever answering named nothing, and
 * falls back to the sentence that says the file did not arrive.
 */
export function refusalKey(refusal: LocalRefusal | string): string {
  return refusal === 'format' || refusal === 'size'
    ? `supply.refused_${refusal}`
    : `error.${refusal}`;
}
