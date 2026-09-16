-- What the National Archive Fund said about each Decree 439 paper, asked by the
-- QR reference printed on it (ADR-0028). One row per document, with the lines
-- of the paper beside the archive's copy of them.
--
-- Nothing to back-fill: no paper has been asked about before this, and a
-- document without a row is exactly what "not checked yet" means.

-- CreateEnum
CREATE TYPE "ArchiveQrCheckStatus" AS ENUM ('Confirmed', 'Differs', 'NotFound', 'NoQrCode');

-- CreateEnum
CREATE TYPE "ArchiveQrFieldVerdict" AS ENUM ('Match', 'Mismatch', 'NotStated');

-- CreateTable
CREATE TABLE "archive_qr_checks" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "status" "ArchiveQrCheckStatus" NOT NULL,
    "qrReference" TEXT,
    "checkedAt" TIMESTAMP(3) NOT NULL,
    "issuingAuthorityCompetent" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "archive_qr_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "archive_qr_check_fields" (
    "id" UUID NOT NULL,
    "archiveQrCheckId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "documentValue" TEXT,
    "archiveValue" TEXT,
    "verdict" "ArchiveQrFieldVerdict" NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "archive_qr_check_fields_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "archive_qr_checks_documentId_key" ON "archive_qr_checks"("documentId");

-- CreateIndex
CREATE INDEX "archive_qr_check_fields_archiveQrCheckId_idx" ON "archive_qr_check_fields"("archiveQrCheckId");

-- AddForeignKey
ALTER TABLE "archive_qr_checks" ADD CONSTRAINT "archive_qr_checks_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "archive_qr_check_fields" ADD CONSTRAINT "archive_qr_check_fields_archiveQrCheckId_fkey" FOREIGN KEY ("archiveQrCheckId") REFERENCES "archive_qr_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
