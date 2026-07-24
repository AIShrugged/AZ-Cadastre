/*
  Warnings:

  - Added the required column `profileKey` to the `verification_packages` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "verification_packages" ADD COLUMN     "profileKey" TEXT NOT NULL;
