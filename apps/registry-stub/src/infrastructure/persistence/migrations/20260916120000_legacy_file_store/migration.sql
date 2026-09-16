-- CreateEnum
CREATE TYPE "LocationKind" AS ENUM ('Folder', 'RegisterBook', 'TechnicalPassportBook', 'InventoryList', 'Box', 'ArchiveFund');

-- CreateEnum
CREATE TYPE "LegacyFileFormat" AS ENUM ('Xls', 'Xlsx', 'Xlsm', 'Dbf', 'DbfMemo', 'DbfIndex', 'DbfContainer', 'Other');

-- CreateEnum
CREATE TYPE "LegacyFileStatus" AS ENUM ('Pending', 'Inspected', 'Landed', 'Skipped', 'Failed', 'Removed');

-- CreateEnum
CREATE TYPE "LegacyFileSkipReason" AS ENUM ('Program', 'Companion', 'Temporary', 'Shortcut', 'Encrypted', 'Duplicate', 'Credentials', 'Unsupported');

-- CreateEnum
CREATE TYPE "LegacyRowStatus" AS ENUM ('Pending', 'Mapped', 'Skipped', 'Refused');

-- CreateEnum
CREATE TYPE "LegacyTableKind" AS ENUM ('Worksheet', 'Chartsheet', 'DbfTable');

-- CreateEnum
CREATE TYPE "SheetVisibility" AS ENUM ('Visible', 'Hidden', 'VeryHidden');

-- CreateEnum
CREATE TYPE "HeaderStatus" AS ENUM ('Found', 'NotFound', 'Empty');

-- CreateEnum
CREATE TYPE "LegacyTableStatus" AS ENUM ('Pending', 'Landed', 'Mapped', 'Skipped', 'Failed');

-- CreateEnum
CREATE TYPE "ClassifiedBy" AS ENUM ('Rule', 'Model', 'Operator');

-- CreateEnum
CREATE TYPE "CollectiveKind" AS ENUM ('GardenAssociation', 'DachaMassif', 'Sovkhoz', 'Other');

-- CreateEnum
CREATE TYPE "RightHolderStanding" AS ENUM ('Current', 'Former', 'Unknown');

-- CreateEnum
CREATE TYPE "StorageEventKind" AS ENUM ('ObjectCreated', 'ObjectRemoved');

-- CreateEnum
CREATE TYPE "StorageEventStatus" AS ENUM ('Received', 'Processing', 'Processed', 'Ignored', 'Failed');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AliasKind" ADD VALUE 'CaseFile';
ALTER TYPE "AliasKind" ADD VALUE 'Order';
ALTER TYPE "AliasKind" ADD VALUE 'Contract';
ALTER TYPE "AliasKind" ADD VALUE 'Decision';
ALTER TYPE "AliasKind" ADD VALUE 'PlotNumber';
ALTER TYPE "AliasKind" ADD VALUE 'LegacyId';

-- DropIndex
DROP INDEX "archive_locations_objectId_key";

-- DropIndex
DROP INDEX "registry_documents_objectId_name_key";

-- AlterTable
ALTER TABLE "archive_locations" ADD COLUMN     "box" TEXT,
ADD COLUMN     "inventoryList" TEXT,
ADD COLUMN     "kind" "LocationKind" NOT NULL DEFAULT 'Folder',
ADD COLUMN     "legacyRowId" UUID,
ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0,
ALTER COLUMN "folder" DROP NOT NULL,
ALTER COLUMN "pages" DROP NOT NULL;

-- AlterTable
ALTER TABLE "registry_addresses" ADD COLUMN     "apartment" TEXT,
ADD COLUMN     "district" TEXT,
ADD COLUMN     "house" TEXT,
ADD COLUMN     "lane" TEXT,
ADD COLUMN     "legacyRowId" UUID,
ADD COLUMN     "massif" TEXT,
ADD COLUMN     "plotNo" TEXT,
ADD COLUMN     "postalCode" TEXT,
ADD COLUMN     "settlement" TEXT,
ADD COLUMN     "street" TEXT;

-- AlterTable
ALTER TABLE "registry_aliases" ADD COLUMN     "legacyRowId" UUID;

-- AlterTable
ALTER TABLE "registry_documents" ADD COLUMN     "legacyRowId" UUID;

-- AlterTable
ALTER TABLE "registry_objects" ADD COLUMN     "collectiveId" UUID,
ADD COLUMN     "legacyRowId" UUID,
ADD COLUMN     "purpose" TEXT,
ADD COLUMN     "rooms" TEXT,
ADD COLUMN     "settlement" TEXT;

-- AlterTable
ALTER TABLE "registry_right_holders" ADD COLUMN     "acquiredOn" TEXT,
ADD COLUMN     "basis" TEXT,
ADD COLUMN     "endedOn" TEXT,
ADD COLUMN     "givenName" TEXT,
ADD COLUMN     "legacyRowId" UUID,
ADD COLUMN     "patronymic" TEXT,
ADD COLUMN     "standing" "RightHolderStanding" NOT NULL DEFAULT 'Current',
ADD COLUMN     "surname" TEXT;

-- CreateTable
CREATE TABLE "legacy_columns" (
    "id" UUID NOT NULL,
    "tableId" UUID NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "letter" TEXT,
    "header" TEXT,
    "headerFolded" TEXT,
    "fieldType" TEXT,
    "fieldTypeName" TEXT,
    "length" INTEGER,
    "decimals" INTEGER,
    "nullable" BOOLEAN,
    "system" BOOLEAN NOT NULL DEFAULT false,
    "field" TEXT,
    "mappedBy" "ClassifiedBy",

    CONSTRAINT "legacy_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legacy_files" (
    "id" UUID NOT NULL,
    "bucket" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "legacyPath" TEXT NOT NULL,
    "directory" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "extension" TEXT NOT NULL,
    "size" BIGINT NOT NULL,
    "modifiedAt" TIMESTAMP(3),
    "etag" TEXT NOT NULL,
    "versionId" TEXT,
    "sha256" TEXT,
    "format" "LegacyFileFormat" NOT NULL,
    "formatDetail" TEXT,
    "status" "LegacyFileStatus" NOT NULL DEFAULT 'Pending',
    "skipReason" "LegacyFileSkipReason",
    "statusReason" TEXT,
    "duplicateOfId" UUID,
    "companionOfId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "removedAt" TIMESTAMP(3),

    CONSTRAINT "legacy_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legacy_rows" (
    "id" UUID NOT NULL,
    "tableId" UUID NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "deleted" BOOLEAN NOT NULL DEFAULT false,
    "cells" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL,
    "status" "LegacyRowStatus" NOT NULL DEFAULT 'Pending',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "legacy_rows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "legacy_tables" (
    "id" UUID NOT NULL,
    "fileId" UUID NOT NULL,
    "kind" "LegacyTableKind" NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "visibility" "SheetVisibility",
    "headerRow" INTEGER,
    "usedRange" TEXT,
    "headerStatus" "HeaderStatus",
    "dbfVersion" TEXT,
    "dbfModifiedOn" DATE,
    "deletedCount" INTEGER,
    "codePage" TEXT,
    "codePageUsed" TEXT,
    "memoFile" TEXT,
    "indexFile" TEXT,
    "container" TEXT,
    "sizeCheck" TEXT,
    "columnCount" INTEGER NOT NULL,
    "rowCount" INTEGER,
    "headerSignature" TEXT,
    "register" TEXT,
    "source" TEXT,
    "classifiedBy" "ClassifiedBy",
    "confidence" DOUBLE PRECISION,
    "status" "LegacyTableStatus" NOT NULL DEFAULT 'Pending',
    "statusReason" TEXT,
    "mappingVersion" TEXT,
    "landedAt" TIMESTAMP(3),
    "mappedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "legacy_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registry_attributes" (
    "id" UUID NOT NULL,
    "objectId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "sourceDatabase" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "legacyRowId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registry_attributes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registry_collectives" (
    "id" UUID NOT NULL,
    "kind" "CollectiveKind" NOT NULL,
    "name" TEXT NOT NULL,
    "district" TEXT,
    "settlement" TEXT,
    "massif" TEXT,
    "decision" TEXT,
    "memberCount" TEXT,
    "note" TEXT,
    "sourceDatabase" TEXT NOT NULL,
    "legacyRowId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registry_collectives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_events" (
    "id" UUID NOT NULL,
    "kind" "StorageEventKind" NOT NULL,
    "eventName" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "objectKey" TEXT NOT NULL,
    "versionId" TEXT,
    "etag" TEXT,
    "size" BIGINT,
    "sequencer" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "StorageEventStatus" NOT NULL DEFAULT 'Received',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "lastError" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "fileId" UUID,

    CONSTRAINT "storage_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "legacy_columns_headerFolded_idx" ON "legacy_columns"("headerFolded");

-- CreateIndex
CREATE INDEX "legacy_columns_field_idx" ON "legacy_columns"("field");

-- CreateIndex
CREATE UNIQUE INDEX "legacy_columns_tableId_ordinal_key" ON "legacy_columns"("tableId", "ordinal");

-- CreateIndex
CREATE INDEX "legacy_files_legacyPath_idx" ON "legacy_files"("legacyPath");

-- CreateIndex
CREATE INDEX "legacy_files_sha256_idx" ON "legacy_files"("sha256");

-- CreateIndex
CREATE INDEX "legacy_files_status_idx" ON "legacy_files"("status");

-- CreateIndex
CREATE UNIQUE INDEX "legacy_files_bucket_objectKey_key" ON "legacy_files"("bucket", "objectKey");

-- CreateIndex
CREATE INDEX "legacy_rows_contentHash_idx" ON "legacy_rows"("contentHash");

-- CreateIndex
CREATE INDEX "legacy_rows_tableId_status_idx" ON "legacy_rows"("tableId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "legacy_rows_tableId_rowNumber_key" ON "legacy_rows"("tableId", "rowNumber");

-- CreateIndex
CREATE INDEX "legacy_tables_headerSignature_idx" ON "legacy_tables"("headerSignature");

-- CreateIndex
CREATE INDEX "legacy_tables_register_idx" ON "legacy_tables"("register");

-- CreateIndex
CREATE INDEX "legacy_tables_status_idx" ON "legacy_tables"("status");

-- CreateIndex
CREATE UNIQUE INDEX "legacy_tables_fileId_ordinal_key" ON "legacy_tables"("fileId", "ordinal");

-- CreateIndex
CREATE INDEX "registry_attributes_objectId_idx" ON "registry_attributes"("objectId");

-- CreateIndex
CREATE INDEX "registry_attributes_key_idx" ON "registry_attributes"("key");

-- CreateIndex
CREATE INDEX "registry_attributes_legacyRowId_idx" ON "registry_attributes"("legacyRowId");

-- CreateIndex
CREATE INDEX "registry_collectives_kind_name_idx" ON "registry_collectives"("kind", "name");

-- CreateIndex
CREATE INDEX "registry_collectives_legacyRowId_idx" ON "registry_collectives"("legacyRowId");

-- CreateIndex
CREATE INDEX "storage_events_status_receivedAt_idx" ON "storage_events"("status", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "storage_events_bucket_objectKey_sequencer_key" ON "storage_events"("bucket", "objectKey", "sequencer");

-- CreateIndex
CREATE INDEX "archive_locations_objectId_idx" ON "archive_locations"("objectId");

-- CreateIndex
CREATE INDEX "archive_locations_legacyRowId_idx" ON "archive_locations"("legacyRowId");

-- CreateIndex
CREATE INDEX "registry_addresses_legacyRowId_idx" ON "registry_addresses"("legacyRowId");

-- CreateIndex
CREATE INDEX "registry_aliases_legacyRowId_idx" ON "registry_aliases"("legacyRowId");

-- CreateIndex
CREATE INDEX "registry_documents_objectId_name_idx" ON "registry_documents"("objectId", "name");

-- CreateIndex
CREATE INDEX "registry_documents_legacyRowId_idx" ON "registry_documents"("legacyRowId");

-- CreateIndex
CREATE INDEX "registry_objects_inventoryNo_idx" ON "registry_objects"("inventoryNo");

-- CreateIndex
CREATE INDEX "registry_objects_legacyRowId_idx" ON "registry_objects"("legacyRowId");

-- CreateIndex
CREATE INDEX "registry_right_holders_legacyRowId_idx" ON "registry_right_holders"("legacyRowId");

-- AddForeignKey
ALTER TABLE "archive_locations" ADD CONSTRAINT "archive_locations_legacyRowId_fkey" FOREIGN KEY ("legacyRowId") REFERENCES "legacy_rows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legacy_columns" ADD CONSTRAINT "legacy_columns_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "legacy_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legacy_files" ADD CONSTRAINT "legacy_files_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "legacy_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legacy_files" ADD CONSTRAINT "legacy_files_companionOfId_fkey" FOREIGN KEY ("companionOfId") REFERENCES "legacy_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legacy_rows" ADD CONSTRAINT "legacy_rows_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "legacy_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "legacy_tables" ADD CONSTRAINT "legacy_tables_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "legacy_files"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registry_addresses" ADD CONSTRAINT "registry_addresses_legacyRowId_fkey" FOREIGN KEY ("legacyRowId") REFERENCES "legacy_rows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registry_aliases" ADD CONSTRAINT "registry_aliases_legacyRowId_fkey" FOREIGN KEY ("legacyRowId") REFERENCES "legacy_rows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registry_attributes" ADD CONSTRAINT "registry_attributes_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "registry_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registry_attributes" ADD CONSTRAINT "registry_attributes_legacyRowId_fkey" FOREIGN KEY ("legacyRowId") REFERENCES "legacy_rows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registry_collectives" ADD CONSTRAINT "registry_collectives_legacyRowId_fkey" FOREIGN KEY ("legacyRowId") REFERENCES "legacy_rows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registry_documents" ADD CONSTRAINT "registry_documents_legacyRowId_fkey" FOREIGN KEY ("legacyRowId") REFERENCES "legacy_rows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registry_objects" ADD CONSTRAINT "registry_objects_collectiveId_fkey" FOREIGN KEY ("collectiveId") REFERENCES "registry_collectives"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registry_objects" ADD CONSTRAINT "registry_objects_legacyRowId_fkey" FOREIGN KEY ("legacyRowId") REFERENCES "legacy_rows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registry_right_holders" ADD CONSTRAINT "registry_right_holders_legacyRowId_fkey" FOREIGN KEY ("legacyRowId") REFERENCES "legacy_rows"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_events" ADD CONSTRAINT "storage_events_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "legacy_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;
