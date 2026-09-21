/**
 * The route somebody asked for before they were sent to sign in, carried in the
 * router's own location state and read back out of it.
 *
 * In the state and not in the query string, because it is not part of the
 * address of the sign-in page: a `?next=` that survives a copied link is an
 * open redirect waiting for somebody to put an absolute URL in it. The state
 * travels in the history entry, and a path is still checked for being one —
 * a value that arrived any other way is dropped rather than navigated to.
 */
import type { Location } from 'react-router-dom';

/** What to put in `state` when sending a reader to the gate. */
export function rememberRoute(location: Location): { from: string } {
  return { from: `${location.pathname}${location.search}` };
}

/** The remembered route, or null when there is none worth trusting. */
export function intendedRoute(state: unknown): string | null {
  if (typeof state !== 'object' || state === null) return null;

  const from = (state as { from?: unknown }).from;

  // A path of this app's own and nothing else: one leading slash, so neither
  // `//elsewhere.example` nor `https://…` can be handed to the router.
  return typeof from === 'string' && /^\/(?!\/)/.test(from) ? from : null;
}
