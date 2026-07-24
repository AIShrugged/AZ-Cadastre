-- CreateEnum
CREATE TYPE "PackageStatus" AS ENUM ('Pending', 'Processing', 'Completed', 'Failed');

-- CreateTable
CREATE TABLE "verification_packages" (
    "id" UUID NOT NULL,
    "status" "PackageStatus" NOT NULL DEFAULT 'Pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_packages_pkey" PRIMARY KEY ("id")
);
