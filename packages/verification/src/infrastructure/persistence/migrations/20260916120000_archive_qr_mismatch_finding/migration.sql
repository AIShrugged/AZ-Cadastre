-- A Decree 439 paper can now be held against the National Archive Fund's copy
-- of it, found by the QR reference printed on the paper, and a report can say
-- the copy does not bear the paper out (ADR-0028).
--
-- Its own migration, as every enum value has been: adding a member to a
-- Postgres enum and writing rows that use it do not belong in one transaction.
ALTER TYPE "IssueKind" ADD VALUE IF NOT EXISTS 'ArchiveQrMismatch';
