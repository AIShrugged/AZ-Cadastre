-- AlterTable
ALTER TABLE "verification_packages" ADD COLUMN     "ownerAccountId" UUID;

-- CreateIndex
CREATE INDEX "verification_packages_ownerAccountId_idx" ON "verification_packages"("ownerAccountId");
