-- CreateEnum
CREATE TYPE "AddressKind" AS ENUM ('Current', 'Legacy', 'Register');

-- CreateEnum
CREATE TYPE "AliasKind" AS ENUM ('Registration', 'Inventory', 'RegisterCode', 'StateAct', 'Certificate', 'TechnicalPassport', 'Application');

-- CreateEnum
CREATE TYPE "DocumentHolding" AS ENUM ('Held', 'NotHeld', 'Unknown');

-- CreateEnum
CREATE TYPE "RightHolderKind" AS ENUM ('Individual', 'LegalEntity');

-- CreateTable
CREATE TABLE "archive_locations" (
    "id" UUID NOT NULL,
    "objectId" UUID NOT NULL,
    "folder" TEXT NOT NULL,
    "pages" TEXT NOT NULL,
    "bookNo" TEXT,
    "sheetNo" TEXT,
    "fundReference" TEXT,
    "sourceDatabase" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "archive_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registry_addresses" (
    "id" UUID NOT NULL,
    "objectId" UUID NOT NULL,
    "kind" "AddressKind" NOT NULL,
    "value" TEXT NOT NULL,
    "sourceDatabase" TEXT,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registry_addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registry_aliases" (
    "id" UUID NOT NULL,
    "objectId" UUID NOT NULL,
    "kind" "AliasKind" NOT NULL,
    "value" TEXT NOT NULL,
    "issuingOffice" TEXT,
    "sourceDatabase" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registry_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registry_documents" (
    "id" UUID NOT NULL,
    "objectId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "holding" "DocumentHolding" NOT NULL,
    "taxonomyRef" TEXT,
    "number" TEXT,
    "issuedOn" TEXT,
    "issuingAuthority" TEXT,
    "folder" TEXT,
    "pages" TEXT,
    "sourceDatabase" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registry_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registry_objects" (
    "id" UUID NOT NULL,
    "registerNo" TEXT NOT NULL,
    "territorialOffice" TEXT NOT NULL,
    "inventoryNo" TEXT,
    "cadastralNumber" TEXT,
    "propertyType" TEXT,
    "district" TEXT,
    "plotArea" TEXT,
    "totalArea" TEXT,
    "mainArea" TEXT,
    "auxiliaryArea" TEXT,
    "footprintArea" TEXT,
    "floors" TEXT,
    "buildYear" INTEGER,
    "ownershipType" TEXT,
    "rightType" TEXT,
    "landOwnershipType" TEXT,
    "landRightType" TEXT,
    "landCategory" TEXT,
    "registryBookNo" TEXT,
    "registryBookSheet" TEXT,
    "sourceDatabase" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "registry_objects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "registry_right_holders" (
    "id" UUID NOT NULL,
    "objectId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "RightHolderKind" NOT NULL,
    "share" TEXT,
    "registrationNo" TEXT,
    "registeredOn" TEXT,
    "previousOwner" TEXT,
    "taxOrDocumentNo" TEXT,
    "position" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "registry_right_holders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "archive_locations_objectId_key" ON "archive_locations"("objectId");

-- CreateIndex
CREATE INDEX "registry_addresses_objectId_idx" ON "registry_addresses"("objectId");

-- CreateIndex
CREATE INDEX "registry_aliases_objectId_idx" ON "registry_aliases"("objectId");

-- CreateIndex
CREATE INDEX "registry_aliases_kind_value_idx" ON "registry_aliases"("kind", "value");

-- CreateIndex
CREATE UNIQUE INDEX "registry_documents_objectId_name_key" ON "registry_documents"("objectId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "registry_objects_territorialOffice_registerNo_key" ON "registry_objects"("territorialOffice", "registerNo");

-- CreateIndex
CREATE INDEX "registry_right_holders_objectId_idx" ON "registry_right_holders"("objectId");

-- AddForeignKey
ALTER TABLE "archive_locations" ADD CONSTRAINT "archive_locations_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "registry_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registry_addresses" ADD CONSTRAINT "registry_addresses_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "registry_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registry_aliases" ADD CONSTRAINT "registry_aliases_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "registry_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registry_documents" ADD CONSTRAINT "registry_documents_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "registry_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "registry_right_holders" ADD CONSTRAINT "registry_right_holders_objectId_fkey" FOREIGN KEY ("objectId") REFERENCES "registry_objects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
