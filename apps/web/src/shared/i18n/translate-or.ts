/**
 * Translating a key composed from data the server sent.
 *
 * Its own file rather than a sixth export from `i18n.tsx`, which React's fast
 * refresh rule already has enough to say about.
 */

/** The `t` from `useI18n`, which answers with the key it was given when it has no word for it. */
type Translate = (
  key: string,
  params?: Record<string, string | number>,
) => string;

/**
 * The word for `key`, or `fallback` when no dictionary has one.
 *
 * That `t` echoes the key back is what makes this checkable — and what makes it
 * necessary: a key is a debugging string, not something to show an inspector.
 * Used where the key comes from the wire (`profile.<key>`, `error.<CODE>`), so
 * the dictionary can legitimately be behind what the engine knows.
 */
export function translateOr(
  t: Translate,
  key: string,
  fallback: string,
): string {
  const word = t(key);
  return word === key ? fallback : word;
}
