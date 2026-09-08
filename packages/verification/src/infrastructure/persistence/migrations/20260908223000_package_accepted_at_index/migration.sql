-- The summary of a period is narrowed by when the submission was accepted, and
-- by nothing else: the packages by this column directly, and the reports, the
-- findings and the register's answers through a join onto it. Without an index
-- every one of those is a full scan of a table that only ever grows.
--
-- No new data and no new state: the summary is derived from what these tables
-- already hold, and this is the one thing the derivation needs from the schema.

-- CreateIndex
CREATE INDEX "verification_packages_createdAt_idx" ON "verification_packages"("createdAt");
