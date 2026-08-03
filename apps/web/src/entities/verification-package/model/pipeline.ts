/** The six pipeline stages, in order (PRD §7): OCR → Document detection →
 *  Classification → Field extraction → Completeness → Report.
 *  Detection is what makes an upload a container: it reads a submitted PDF into
 *  the one-or-more documents it actually holds. Completeness and the report are
 *  compiled together when the run finishes, and a run always finishes: a
 *  document that could not be read is a finding in the report, not a stop. */
export const STAGES = 6
