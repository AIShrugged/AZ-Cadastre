/**
 * What the edge needs to know to issue and read a session. Handed in by the
 * composition root with the rest of the gateway's wiring; nothing under `libs/`
 * reads `process.env`.
 */
export type SessionOptions = {
  /**
   * The key the session token is signed with.
   *
   * Every token this process issues stops being accepted when it changes — a
   * restart with a new secret signs everybody out, which is why a deployment
   * sets one and keeps it rather than letting the process invent one.
   */
  readonly secret: string;
  /** How long a session lasts, in seconds, from the moment it is issued. */
  readonly ttlSeconds: number;
  /**
   * Whether the cookie carries `Secure`.
   *
   * `false` is a stand served over plain HTTP, where a `Secure` cookie is one
   * the browser never sends back and the symptom is a login that appears to
   * work and then 401s. Anywhere there is TLS this is `true`, and it is a
   * setting rather than a guess because only the deployment knows.
   */
  readonly secure: boolean;
};

/** Injection token for the resolved session options. */
export const SESSION_OPTIONS = 'SESSION_OPTIONS';

/**
 * The cookie the session travels in.
 *
 * `httpOnly`, so script cannot read it: the web client is a browser app, and a
 * token JavaScript can reach is a token every XSS can reach. `SameSite=Lax`, so
 * it is not sent on a cross-site POST — which is the whole of this API's CSRF
 * defence and the reason no state-changing route may ever be a GET.
 */
export const SESSION_COOKIE = 'cadastre_session';
