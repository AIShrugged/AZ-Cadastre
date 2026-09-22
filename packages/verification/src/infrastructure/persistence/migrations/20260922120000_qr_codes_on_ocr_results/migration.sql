-- The QR codes decoded off a sheet, beside the transcription made from it
-- (ADR-0034).
--
-- Empty on every row that exists, which is correct and not a backfill waiting
-- to happen: nothing decoded a code before this migration, and a re-run of the
-- package is what fills them. A sheet that prints no code keeps an empty array
-- for good.
ALTER TABLE "ocr_results" ADD COLUMN "codes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
