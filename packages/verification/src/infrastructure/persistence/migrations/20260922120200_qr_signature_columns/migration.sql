-- What the issuer of a QR code said about the sheet: who signed the electronic
-- original, for which body and section, and whether the signature verifies
-- (ADR-0034).
--
-- All nullable and all empty on the rows that exist. Nothing is backfilled: no
-- check made before this asked a service that verifies signatures, and a re-run
-- of the package is what fills them.
ALTER TABLE "archive_qr_checks"
  ADD COLUMN "issuer" TEXT,
  ADD COLUMN "signatureSignedBy" TEXT,
  ADD COLUMN "signatureOrganisation" TEXT,
  ADD COLUMN "signatureUnit" TEXT,
  ADD COLUMN "signatureSignedOn" TEXT,
  ADD COLUMN "signatureValid" BOOLEAN;
