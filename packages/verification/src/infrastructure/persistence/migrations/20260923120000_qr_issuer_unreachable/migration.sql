-- The issuer of a QR code was asked and did not answer (ADR-0037).
--
-- A state of its own and not `NotFound`: nobody looked, so nothing was found or
-- not found, and the report has to tell an inspector that the paper is
-- unchecked rather than leave the check off the page.
--
-- Nothing is backfilled. A check that failed this way before now was never
-- written at all — the stage threw and the row was never made — so there is no
-- row to move, and a re-run of the package is what produces one.
ALTER TYPE "ArchiveQrCheckStatus" ADD VALUE IF NOT EXISTS 'IssuerUnreachable';
