import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';

/**
 * Base RTK Query API for the core (NestJS) service. Feature/entity layers extend
 * it with `injectEndpoints`, so this stays endpoint-free. Same `/api` origin as
 * the `http` axios client — proxied to the service by Vite in dev.
 */
export const api = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  /*
   * What a cached answer can be keyed on, and so what a mutation can make
   * stale. `RegistrySummary` is the archive band's figures: they are the
   * register's own count, and the one thing that moves them — a workbook
   * import — does not pass through this base query at all (ADR-0011 §1), so the
   * tag is what gives that import somewhere to say the count has changed.
   */
  tagTypes: ['Package', 'RegistrySummary'],
  endpoints: () => ({}),
});
