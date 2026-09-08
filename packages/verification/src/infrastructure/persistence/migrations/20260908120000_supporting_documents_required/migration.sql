-- A report could say two things: what the package is short of, and how sure the
-- engine was of its reading. It could not say what the applicant has to bring
-- next — the supporting documents a case needs because of how tall the building
-- is and what year it is dated by. Those papers are never in the envelope and
-- are never checked, so the message is stated for the applicant and counts for
-- nothing against the package (ADR-0013).
ALTER TYPE "IssueKind" ADD VALUE IF NOT EXISTS 'SupportingDocumentsRequired';
