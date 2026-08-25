-- The register stage (ADR-0009): the property a submission is for, looked up in
-- the archive register, and what the record says held against what the papers
-- say.
--
-- Two issue kinds arrive with it, and they are deliberately not one. A record
-- that contradicts the package is a finding against it; a register that held no
-- record, or held two, is told to the inspector and counts for nothing — its
-- coverage is the privatisations of the 1990s and 2000s and not everything that
-- exists, so an absence there is not evidence about the submission.

CREATE TYPE "RegistryOutcome" AS ENUM ('Confirmed', 'Differs', 'NotFound', 'Ambiguous');

ALTER TYPE "IssueKind" ADD VALUE 'RegistryMismatch';
ALTER TYPE "IssueKind" ADD VALUE 'RegistryUnconfirmed';

CREATE TABLE "registry_checks" (
    "id" UUID NOT NULL,
    "packageId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "outcome" "RegistryOutcome" NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "note" TEXT NOT NULL,
    "reference" TEXT,
    "documentId" UUID,
    "documentType" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "valueConfidence" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registry_checks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "registry_check_attributes" (
    "id" UUID NOT NULL,
    "registryCheckId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "agrees" BOOLEAN NOT NULL,
    "recorded" TEXT,
    "documentId" UUID,
    "documentType" TEXT NOT NULL,
    "fieldName" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registry_check_attributes_pkey" PRIMARY KEY ("id")
);

-- One answer per check per package, so a re-run replaces rather than duplicates.
CREATE UNIQUE INDEX "registry_checks_packageId_key_key" ON "registry_checks"("packageId", "key");

CREATE INDEX "registry_check_attributes_registryCheckId_idx" ON "registry_check_attributes"("registryCheckId");

ALTER TABLE "registry_checks" ADD CONSTRAINT "registry_checks_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "verification_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "registry_checks" ADD CONSTRAINT "registry_checks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "registry_check_attributes" ADD CONSTRAINT "registry_check_attributes_registryCheckId_fkey" FOREIGN KEY ("registryCheckId") REFERENCES "registry_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "registry_check_attributes" ADD CONSTRAINT "registry_check_attributes_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
