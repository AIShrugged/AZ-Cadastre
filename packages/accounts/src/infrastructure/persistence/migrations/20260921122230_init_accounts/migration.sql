-- CreateEnum
CREATE TYPE "AccountRole" AS ENUM ('operator', 'user');

-- CreateTable
CREATE TABLE "accounts" (
    "id" UUID NOT NULL,
    "login" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "AccountRole" NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_login_key" ON "accounts"("login");
