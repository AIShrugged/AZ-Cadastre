/*
 * Where the policy expects a paper of a given kind to come from: the envelope
 * the applicant brought, or a state system the registry reads it out of
 * (ADR-0025).
 *
 * The acceptance contract's field table names the source of every document it
 * asks fields of — "uploaded in the package", MQS, the Licences Portal, the
 * Urban Planning Committee, the National Archive — and a paper whose source is a
 * system is a paper whose authenticity that system confirms. None of those
 * systems is connected to this one. The source is declared anyway, so a report
 * can say which check the policy asks for and was not made, rather than letting
 * a paper that was only read look like a paper that was confirmed.
 */
export const DOCUMENT_SOURCES = [
  // Uploaded by the applicant and checked against nothing outside the package.
  'Package',
  // The State Register of Immovable Property and the systems behind it: the
  // extract, the plan of the plot, and the identity data from IAMAS via EHİS.
  'Mqs',
  // The Ministry of Economy's Licences and Permits Portal: whether a design
  // licence is valid, asked by the taxpayer number of the design organisation.
  'LicencesPortal',
  // The information system of the Committee for Urban Planning and
  // Architecture: permits, permits for operation and notifications.
  'UrbanPlanningCommittee',
  // The National Archive Fund: the original of a Soviet-era title and the QR
  // code of an archival reference (Decree No. 439, point 7).
  'NationalArchive',
] as const;

export type DocumentSource = (typeof DOCUMENT_SOURCES)[number];
