/**
 * The signal that says the session is gone, and the one place the app hears it.
 *
 * Two transports reach the core service — RTK Query for everything the screens
 * read, axios for the bytes of a document — and either of them can be the first
 * to be told the cookie no longer opens anything. A 401 is not that transport's
 * business to act on: what happens next is a route change, and neither a base
 * query nor an interceptor may navigate.
 *
 * So they say it here and nothing else, and whoever is holding the session asks
 * again. That is the whole of the mechanism: a notification, not a decision. It
 * lives in `shared/` because both transports do, and because the layer that
 * reacts — the account entity — is one the transports may not import.
 *
 * `GET /auth/me` is deliberately **not** a caller: asking who this is, and
 * being told nobody, is the answer and not a loss. A refusal from it that rang
 * this bell would ask it again, and again.
 */
type Listener = () => void;

const listeners = new Set<Listener>();

/** Listen for it. Returns the unsubscribe, so an effect can hand it straight back. */
export function onSessionLost(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Say it. Safe to call on every refused request — the listener decides. */
export function sessionLost(): void {
  for (const listener of listeners) listener();
}
