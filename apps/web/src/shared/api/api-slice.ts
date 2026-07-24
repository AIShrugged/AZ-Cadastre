import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react"

/**
 * Base RTK Query API for the core (NestJS) service. Feature/entity layers extend
 * it with `injectEndpoints`, so this stays endpoint-free. Same `/api` origin as
 * the `http` axios client — proxied to the service by Vite in dev.
 */
export const api = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({ baseUrl: "/api" }),
  tagTypes: ["Package"],
  endpoints: () => ({}),
})
