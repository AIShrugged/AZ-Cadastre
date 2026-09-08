-- Everything else in this database is something the engine worked out. This is
-- the one thing a person put in: their sign-off on what the archive register
-- answered about a submission, the conclusion they drew from it, and — where
-- they had one — a remark on signing (ADR-0016).
--
-- A table and not a column on the package, because an approval is an event. It
-- covers the state of the archive search it was given, so a run that asks the
-- register again ends it: `supersededAt` is filled in and the row stays on
-- file. A package has at most one row with `supersededAt` null, and that is the
-- whole of what anything reads to decide whether the search is approved.
--
-- No author column, deliberately: there are no accounts in this system, so
-- there is nothing to read a name off and a free-text box for one would look
-- like accountability without being any. It is one more column when they exist.
-- CreateTable
CREATE TABLE "archive_search_approvals" (
    "id" UUID NOT NULL,
    "packageId" UUID NOT NULL,
    "summary" TEXT NOT NULL,
    "comment" TEXT,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" TIMESTAMP(3),

    CONSTRAINT "archive_search_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "archive_search_approval_checks" (
    "id" UUID NOT NULL,
    "approvalId" UUID NOT NULL,
    "key" TEXT NOT NULL,
    "outcome" "RegistryOutcome" NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "archive_search_approval_checks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "archive_search_approvals_packageId_idx" ON "archive_search_approvals"("packageId");

-- CreateIndex
CREATE INDEX "archive_search_approval_checks_approvalId_idx" ON "archive_search_approval_checks"("approvalId");

-- AddForeignKey
ALTER TABLE "archive_search_approvals" ADD CONSTRAINT "archive_search_approvals_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "verification_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "archive_search_approval_checks" ADD CONSTRAINT "archive_search_approval_checks_approvalId_fkey" FOREIGN KEY ("approvalId") REFERENCES "archive_search_approvals"("id") ON DELETE CASCADE ON UPDATE CASCADE;
