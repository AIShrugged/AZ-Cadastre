-- A report can now say that the check of authenticity by QR code was skipped
-- because no paper of the package prints a code (ADR-0031).
--
-- Its own migration, as every enum value has been: adding a member to a
-- Postgres enum and writing rows that use it do not belong in one transaction.
ALTER TYPE "IssueKind" ADD VALUE IF NOT EXISTS 'QrCodeUnavailable';
