-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "packageId" UUID NOT NULL,
    "originalFilename" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "type" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "documents_storageKey_key" ON "documents"("storageKey");

-- CreateIndex
CREATE INDEX "documents_packageId_idx" ON "documents"("packageId");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "verification_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
