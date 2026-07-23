import axios from "axios"

/**
 * App-wide client for the core (NestJS) API. In dev, `/api` is proxied to the
 * service by Vite (see vite.config.ts); in prod it is served under the same
 * origin. Direct-to-storage PUTs use a bare axios call, not this instance.
 */
export const http = axios.create({
  baseURL: "/api",
})
