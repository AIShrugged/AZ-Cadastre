import { Agent, type Dispatcher } from 'undici';

import type { Logger } from '@cadastre/logger';

/**
 * How this system talks to the National Archive Fund: over IPv4, and once more
 * if the wire fails (COMM-144).
 *
 * The archive's zone has no AAAA records and its authoritative servers answer
 * an AAAA question with silence rather than with "no such record". Node asks
 * for both families at once and fails the whole resolution on the one that
 * never comes back, so every call to the archive died on the resolver's own
 * five-second timeout — whatever the configured request timeout was — and the
 * QR check silently never happened. Measured on the stand and reproduced under
 * both musl and glibc, so it is the zone and not the container.
 *
 * Local to the archive on purpose. A process-wide `dns.setDefaultResultOrder`
 * or a global dispatcher would change how every other integration reaches
 * everything, to fix one zone that the rest of them do not live in.
 */

// Ask DNS for A records and nothing else. `autoSelectFamily` is said out loud
// because Node turns it on by default, and what it does is try both families —
// which is the thing that does not come back here.
const IPV4_ONLY = { family: 4, autoSelectFamily: false } as const;

/*
 * One connection pool for the archive, made on first use.
 *
 * Shared because it is a pool and a pool per request is not one; made lazily
 * because a deployment that talks to the stand-in never opens a socket to the
 * archive at all.
 */
let shared: Agent | undefined;

/**
 * A dispatcher that resolves over IPv4 only. `connect` takes the same options
 * `net.connect` does — a test hands it a `lookup` of its own to watch what is
 * asked of DNS.
 */
export function ipv4OnlyAgent(connect: Record<string, unknown> = {}): Agent {
  return new Agent({ connect: { ...IPV4_ONLY, ...connect } });
}

export type ArchiveRequest = {
  readonly headers: Record<string, string>;
  /*
   * The budget for one attempt, not for the call. A retry gets its own: the
   * point of the retry is that the first attempt was not an answer.
   */
  readonly timeoutMs: number;
  readonly logger?: Logger;
  // The pool to go through. The archive's own unless a test names another.
  readonly dispatcher?: Dispatcher;
};

/*
 * Two attempts and no more.
 *
 * One request per package, so the retry costs nothing worth counting, and what
 * it buys is the difference between a paper checked and a paper silently not
 * checked. A third attempt would only lengthen a run that is already failing.
 */
const ATTEMPTS = 2;

export async function fetchFromTheArchive(
  url: string | URL,
  request: ArchiveRequest,
): Promise<Response> {
  const dispatcher = request.dispatcher ?? (shared ??= ipv4OnlyAgent());
  let failure: unknown;

  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      /*
       * Node's `fetch` is undici's, and it takes the pool to go through on
       * `dispatcher` — which the DOM's `RequestInit` does not declare, hence
       * the widened type rather than a cast that would hide a real mistake.
       *
       * A timeout per attempt, so the retry is a fresh budget: the first
       * attempt failing is the reason there is a second one.
       */
      const init: RequestInit & { dispatcher: Dispatcher } = {
        method: 'GET',
        headers: request.headers,
        signal: AbortSignal.timeout(request.timeoutMs),
        dispatcher,
      };

      return await fetch(url, init);
    } catch (error) {
      failure = error;

      if (attempt === ATTEMPTS || !worthOneMoreTry(error)) break;

      request.logger?.debug('The archive did not answer; asking once more', {
        attempt,
        error,
      });
    }
  }

  throw failure;
}

/*
 * Whether the failure was the wire rather than the answer.
 *
 * A transport failure carries an errno — `EAI_AGAIN` off a resolver that gave
 * up, `ECONNRESET`, `UND_ERR_SOCKET` — and those are the ones a second attempt
 * can come back from. Two failures are deliberately not retried: a request the
 * caller aborted, and an attempt that ran out its own timeout. A timeout means
 * the archive was reached and is slow, and asking again doubles the wait for
 * every package in the queue to buy an answer the first attempt was already
 * waiting for.
 */
function worthOneMoreTry(error: unknown): boolean {
  if (
    error instanceof Error &&
    (error.name === 'TimeoutError' || error.name === 'AbortError')
  ) {
    return false;
  }

  return codeOf(error) !== null;
}

// `fetch` wraps the real failure: a `TypeError: fetch failed` whose `cause`
// carries the errno.
function codeOf(error: unknown): string | null {
  const causes = [error, (error as { cause?: unknown } | null)?.cause];

  for (const one of causes) {
    const code = (one as { code?: unknown } | null)?.code;

    if (typeof code === 'string' && code.length > 0) return code;
  }

  return null;
}
