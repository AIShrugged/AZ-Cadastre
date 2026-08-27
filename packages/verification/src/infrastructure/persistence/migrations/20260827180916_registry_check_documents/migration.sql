-- CreateEnum
CREATE TYPE "ArchiveHolding" AS ENUM ('Held', 'NotHeld', 'Unknown');

-- AlterEnum
ALTER TYPE "IssueKind" ADD VALUE 'RegistryDocumentMissing';

-- AlterEnum
ALTER TYPE "RegistryOutcome" ADD VALUE 'Incomplete';

-- CreateTable
CREATE TABLE "registry_check_documents" (
    "id" UUID NOT NULL,
    "registryCheckId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "holding" "ArchiveHolding" NOT NULL,
    "recordedNumber" TEXT,
    "recordedDate" TEXT,
    "reference" TEXT,
    "documentId" UUID,
    "documentType" TEXT NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registry_check_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "registry_check_documents_registryCheckId_idx" ON "registry_check_documents"("registryCheckId");

-- AddForeignKey
ALTER TABLE "registry_check_documents" ADD CONSTRAINT "registry_check_documents_registryCheckId_fkey" FOREIGN KEY ("registryCheckId") REFERENCES "registry_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registry_check_documents" ADD CONSTRAINT "registry_check_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
