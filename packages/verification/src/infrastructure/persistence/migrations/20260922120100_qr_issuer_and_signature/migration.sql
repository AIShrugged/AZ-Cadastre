-- A QR check can now say that the code was decoded and whoever issued it is not
-- connected to this system, and can carry what the issuer said about the sheet
-- itself rather than about what the sheet says (ADR-0034).
--
-- The enum value goes first and alone: adding a member to a Postgres enum and
-- writing rows that use it do not belong in one transaction.
ALTER TYPE "ArchiveQrCheckStatus" ADD VALUE IF NOT EXISTS 'IssuerNotConnected';
