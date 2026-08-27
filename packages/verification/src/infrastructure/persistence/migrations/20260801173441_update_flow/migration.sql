/*
  Warnings:

  - You are about to drop the column `contentType` on the `documents` table. All the data in the column will be lost.
  - You are about to drop the column `originalFilename` on the `documents` table. All the data in the column will be lost.
  - You are about to drop the column `storageKey` on the `documents` table. All the data in the column will be lost.
  - You are about to drop the column `documentId` on the `pages` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[sourceFileId,firstPage]` on the table `documents` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[sourceFileId,pageNumber]` on the table `pages` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `firstPage` to the `documents` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lastPage` to the `documents` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sourceFileId` to the `documents` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sourceFileId` to the `pages` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "pages" DROP CONSTRAINT "pages_documentId_fkey";

-- DropIndex
DROP INDEX "documents_storageKey_key";

-- DropIndex
DROP INDEX "pages_documentId_pageNumber_key";

-- AlterTable
ALTER TABLE "documents" DROP COLUMN "contentType",
DROP COLUMN "originalFilename",
DROP COLUMN "storageKey",
ADD COLUMN     "firstPage" INTEGER NOT NULL,
ADD COLUMN     "lastPage" INTEGER NOT NULL,
ADD COLUMN     "sourceFileId" UUID NOT NULL;

-- AlterTable
ALTER TABLE "pages" DROP COLUMN "documentId",
ADD COLUMN     "sourceFileId" UUID NOT NULL;

-- CreateTable
CREATE TABLE "source_files" (
    "id" UUID NOT NULL,
    "packageId" UUID NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "source_files_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "source_files_storageKey_key" ON "source_files"("storageKey");

-- CreateIndex
CREATE INDEX "source_files_packageId_idx" ON "source_files"("packageId");

-- CreateIndex
CREATE UNIQUE INDEX "documents_sourceFileId_firstPage_key" ON "documents"("sourceFileId", "firstPage");

-- CreateIndex
CREATE UNIQUE INDEX "pages_sourceFileId_pageNumber_key" ON "pages"("sourceFileId", "pageNumber");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "source_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_sourceFileId_fkey" FOREIGN KEY ("sourceFileId") REFERENCES "source_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "source_files" ADD CONSTRAINT "source_files_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "verification_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
