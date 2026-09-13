-- The required set of a first registration turns on the provision of Article 8
-- the case falls under (ADR-0025), and a report can now say four things it could
-- not: that no paper of the package is a title to the land, that a title does
-- not found the case, that which provision applies could not be decided, and
-- that a paper the policy confirms through a state system was only read.
--
-- `SupportingDocumentsRequired` stays: reports written before this carry it, and
-- a Postgres enum cannot drop a value rows still use.
--
-- Its own migration, as every enum value has been: adding a member to a
-- Postgres enum and writing rows that use it do not belong in one transaction.
ALTER TYPE "IssueKind" ADD VALUE IF NOT EXISTS 'MissingTitleDocument';
ALTER TYPE "IssueKind" ADD VALUE IF NOT EXISTS 'TitleDocumentInvalid';
ALTER TYPE "IssueKind" ADD VALUE IF NOT EXISTS 'ProvisionUndetermined';
ALTER TYPE "IssueKind" ADD VALUE IF NOT EXISTS 'IntegrationNotConnected';
