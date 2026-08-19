-- The cross-document stage: the papers of one submission held against each
-- other on the values the profile says must be one value — the name on the
-- identity card against the name the application is made in.
--
-- `FieldMismatch` was already reserved in "IssueKind"; from here a stage
-- actually produces it.

CREATE TYPE "CrossCheckVerdict" AS ENUM ('Match', 'Mismatch', 'Unclear');

CREATE TABLE "cross_checks" (
    "id" UUID NOT NULL,
    "packageId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "verdict" "CrossCheckVerdict" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cross_checks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "cross_check_values" (
    "id" UUID NOT NULL,
    "crossCheckId" UUID NOT NULL,
    "documentId" UUID,
    "documentType" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cross_check_values_pkey" PRIMARY KEY ("id")
);

-- One answer per check per package, so a re-run replaces rather than duplicates.
CREATE UNIQUE INDEX "cross_checks_packageId_key_key" ON "cross_checks"("packageId", "key");

CREATE INDEX "cross_check_values_crossCheckId_idx" ON "cross_check_values"("crossCheckId");

ALTER TABLE "cross_checks" ADD CONSTRAINT "cross_checks_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "verification_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cross_check_values" ADD CONSTRAINT "cross_check_values_crossCheckId_fkey" FOREIGN KEY ("crossCheckId") REFERENCES "cross_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "cross_check_values" ADD CONSTRAINT "cross_check_values_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- A mismatch is about a rule, not about one field, so the finding carries the
-- rule it came out of and a reader can name it in their own language.
ALTER TABLE "validation_issues" ADD COLUMN "checkKey" TEXT;
