import axios from 'axios';

import { sessionLost } from './session-lost';

/**
 * App-wide client for the core (NestJS) API. In dev, `/api` is proxied to the
 * service by Vite (see vite.config.ts); in prod it is served under the same
 * origin. Direct-to-storage PUTs use a bare axios call, not this instance.
 *
 * `withCredentials` for the same reason the RTK Query base query sets
 * `credentials: 'include'`: the session is an httpOnly cookie, and a request
 * that does not carry it is a request that arrives as a stranger.
 */
export const http = axios.create({
  baseURL: '/api',
  withCredentials: true,
});

/*
 * A 401 here is the same news as a 401 there, and it is said in the same place.
 * Nothing is swallowed — the rejection travels on to whoever made the call, so
 * a presign that fails still fails — this only rings the bell on the way past.
 */
http.interceptors.response.use(
  response => response,
  (error: unknown) => {
    const status = (error as { response?: { status?: number } }).response
      ?.status;
    if (status === 401) sessionLost();
    return Promise.reject(error);
  },
);
