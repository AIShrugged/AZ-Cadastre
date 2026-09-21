import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';

import { sessionLost } from './session-lost';

/**
 * The session travels as an httpOnly cookie, so there is no token for this
 * client to hold and nothing to put in a header — there is only telling `fetch`
 * to send the cookie it already has. Stated once, here, because a call that
 * forgot it would not fail loudly: it would arrive unauthenticated and come
 * back 401, which reads on screen as "your session expired".
 *
 * Same-origin in dev and in production alike (Vite proxies `/api`), so `include`
 * rather than `same-origin` costs nothing and survives the day the API is moved
 * to an origin of its own.
 */
const request = fetchBaseQuery({ baseUrl: '/api', credentials: 'include' });

/** The URL an RTK Query call is for, whichever of the two shapes it was written in. */
function urlOf(args: string | FetchArgs): string {
  return typeof args === 'string' ? args : args.url;
}

/**
 * The four auth routes answer 401 as part of their job — a wrong password on
 * sign-in, and "nobody is signed in" from `me` — so a refusal from them is an
 * answer this app reads, never a session it has just lost.
 */
function isAuthRoute(url: string): boolean {
  return url.startsWith('/auth/') || url.startsWith('auth/');
}

/**
 * Every other 401 is the session going out from under whatever was on screen.
 * The base query says so and does nothing else; the app takes the reader back
 * to sign-in (`onSessionLost`), because a toast on a screen that can no longer
 * load anything is not something a reader can act on.
 */
const baseQuery: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  const result = await request(args, api, extraOptions);

  if (result.error?.status === 401 && !isAuthRoute(urlOf(args))) sessionLost();

  return result;
};

/**
 * Base RTK Query API for the core (NestJS) service. Feature/entity layers extend
 * it with `injectEndpoints`, so this stays endpoint-free. Same `/api` origin as
 * the `http` axios client — proxied to the service by Vite in dev.
 */
export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  /*
   * What a cached answer can be keyed on, and so what a mutation can make
   * stale. `RegistrySummary` is the archive band's figures: they are the
   * register's own count, and the one thing that moves them — a workbook
   * import — does not pass through this base query at all (ADR-0011 §1), so the
   * tag is what gives that import somewhere to say the count has changed.
   *
   * `Session` is who the caller is. Signing in and signing out are the two
   * writes over it, and every screen that draws a name or a role reads it
   * through the one query they invalidate.
   */
  tagTypes: ['Package', 'RegistrySummary', 'Session'],
  endpoints: () => ({}),
});
