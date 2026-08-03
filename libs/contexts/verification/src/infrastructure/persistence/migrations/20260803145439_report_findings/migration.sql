-- AlterEnum
ALTER TYPE "IssueKind" ADD VALUE 'UnreadableDocument';

-- AlterTable
ALTER TABLE "validation_issues" ADD COLUMN     "sourceFileId" UUID;

-- AddForeignKey
ALTER TABLE "validation_issues" ADD CONSTRAINT "validation_issues_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "source_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
