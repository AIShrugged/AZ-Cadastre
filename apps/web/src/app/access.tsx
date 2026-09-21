/**
 * The two gates the route map hangs on: is anybody signed in, and is this map
 * theirs.
 *
 * They are layout routes with no path of their own, so the map below them reads
 * as the map — `/cases` is still written `/cases` — and the question of who may
 * be there is asked once, above, instead of at the top of every surface.
 *
 * **What they are not is a permission system.** What a role may actually reach
 * is the server's, enforced on every request and answered 403 or 404 (ADR-0029);
 * these decide which map is worth drawing, which is the client's own question
 * and a smaller one. A guard here that disagreed with the server would only
 * change what a person sees before they are refused.
 */
import { useEffect } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

import { useSession, type AccountRole } from '@/entities/account';
import { onSessionLost } from '@/shared/api';
import { paths } from '@/shared/config';
import { rememberRoute } from '@/shared/lib/intended-route';
import { GateHold, GateUnreachable } from '@/widgets/gate';

/**
 * Nothing below this renders until `GET /auth/me` has answered.
 *
 * Held rather than guessed, and that is the whole point of the hold: a shell
 * drawn before the answer arrives is a navigation the reader may not have,
 * taken away again a moment later — and on a slow connection it is the only
 * thing they saw.
 *
 * It is also where a 401 from anywhere else in the app lands. The transports
 * only say that one happened (`onSessionLost`); this asks the session again,
 * and if it really has gone the answer is a 401 from `me`, which is this
 * component's ordinary "nobody is signed in" and takes the reader to the gate.
 * A refusal that was about something else — a route this role may not call —
 * leaves `me` answering normally and nothing moves.
 */
export function RequireSession() {
  const { session, refetch } = useSession();
  const location = useLocation();

  useEffect(() => onSessionLost(refetch), [refetch]);

  switch (session.state) {
    case 'asking':
      return <GateHold />;
    case 'unreachable':
      return <GateUnreachable onRetry={refetch} />;
    case 'anonymous':
      // Where they were going travels with them, so signing in puts them there
      // and not on a home page they then have to navigate back out of.
      return (
        <Navigate to={paths.login} replace state={rememberRoute(location)} />
      );
    case 'signed-in':
      return <Outlet />;
  }
}

/**
 * The branch of the map this role reads. Anyone else is sent to their own home
 * rather than shown an empty screen: the surfaces under here are not empty for
 * them, they are refused, and a register that draws nothing because every row
 * was 403 is a screen that looks broken.
 */
export function RequireRole({ role }: { role: AccountRole }) {
  const { session } = useSession();

  // Only ever mounted under `RequireSession`, which has already held the page
  // until there is an answer; anything else here is that answer changing under
  // a render and is one tick from being redirected anyway.
  if (session.state !== 'signed-in') return null;

  return session.account.role === role ? (
    <Outlet />
  ) : (
    <Navigate to={paths.home(session.account.role)} replace />
  );
}

/** A path in nobody's map. The reader is put at the head of their own. */
export function NoSuchRoute() {
  const { session } = useSession();

  if (session.state !== 'signed-in') return null;

  return <Navigate to={paths.home(session.account.role)} replace />;
}
