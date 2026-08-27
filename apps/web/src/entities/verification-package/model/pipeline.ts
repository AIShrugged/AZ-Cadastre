/** The eight pipeline stages, in order (PRD §7, ADR-0009): OCR → Document
 *  detection → Classification → Field extraction → Cross-document check →
 *  Archive register → Completeness → Report.
 *  Detection is what makes an upload a container: it reads a submitted PDF into
 *  the one-or-more documents it actually holds. The cross-document check is the
 *  first stage that reads two documents at once — whether the name on the
 *  identity card is the name the application is made in. The register is the
 *  only stage that leaves the submission: it asks the archive what it holds
 *  about the property, which is why it runs last of the reading stages — it
 *  needs the values every stage above it produced. Completeness and the
 *  report are compiled together when the run finishes, and a run always
 *  finishes: a document that could not be read is a finding in the report, not
 *  a stop, and neither is a register that did not answer. */
export const STAGES = 8;
