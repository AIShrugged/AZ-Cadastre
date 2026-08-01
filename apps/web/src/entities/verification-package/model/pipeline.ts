/** The seven pipeline stages, in order (PRD §7): OCR → Document detection →
 *  Classification → Field extraction → Completeness → Cross-checks → Report.
 *  Detection is what makes an upload a container: it reads a submitted PDF into
 *  the one-or-more documents it actually holds. */
export const STAGES = 7
