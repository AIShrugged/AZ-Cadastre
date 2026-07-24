-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OK', 'IssuesFound', 'IncompletePackage');

-- CreateEnum
CREATE TYPE "IssueKind" AS ENUM ('MissingDocument', 'FieldMismatch', 'Expired', 'LowConfidence');

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "packageId" UUID NOT NULL,
    "status" "ReportStatus" NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "validation_issues" (
    "id" UUID NOT NULL,
    "reportId" UUID NOT NULL,
    "kind" "IssueKind" NOT NULL,
    "message" TEXT NOT NULL,
    "documentId" UUID,
    "documentType" TEXT,
    "fieldName" TEXT,
    "pageNumber" INTEGER,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "validation_issues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reports_packageId_key" ON "reports"("packageId");

-- CreateIndex
CREATE INDEX "validation_issues_reportId_idx" ON "validation_issues"("reportId");

-- CreateIndex
CREATE INDEX "validation_issues_documentId_idx" ON "validation_issues"("documentId");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "verification_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_issues" ADD CONSTRAINT "validation_issues_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "validation_issues" ADD CONSTRAINT "validation_issues_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
