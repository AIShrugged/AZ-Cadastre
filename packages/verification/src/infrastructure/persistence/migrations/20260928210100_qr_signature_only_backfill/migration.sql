-- The rows already written as a confirmation of nothing (ADR-0048).
--
-- Backfilled, unlike the enum values added before it, because these rows are
-- what an inspector is reading right now: the read model serves the stored
-- status straight out of this column without passing it through the domain, so a
-- report made before this migration would keep saying `Confirmed` until its
-- package happened to be verified again.
--
-- The condition is the domain's, written in SQL: a check that reached a verdict
-- and holds no line with a verdict of `Match` or `Mismatch` compared nothing.
-- `Differs` is left alone — the finding there is the signature or the issuing
-- body, and it is a finding whether or not a line was compared.
UPDATE "archive_qr_checks" AS c
SET "status" = 'SignatureOnly'
WHERE c."status" = 'Confirmed'
  AND NOT EXISTS (
    SELECT 1
    FROM "archive_qr_check_fields" AS f
    WHERE f."archiveQrCheckId" = c."id"
      AND f."verdict" IN ('Match', 'Mismatch')
  );
