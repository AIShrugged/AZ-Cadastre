-- How long the certificate the sheet was signed with is good for, in the words
-- the signature panel of the archive's own signed PDF prints it in (ADR-0035).
--
-- Nullable and empty on every row that exists. Nothing is backfilled: the
-- period is read off the PDF the QR link serves, no check made before this
-- fetched one, and a re-run of the package is what fills it.
ALTER TABLE "archive_qr_checks"
  ADD COLUMN "signatureCertificateValidity" TEXT;
