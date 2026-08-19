-- A document the run read perfectly well and the profile does not ask for is
-- not an unreadable one, and a second extract answering an already-answered
-- requirement is not a fault. Both are told to the inspector under their own
-- names rather than under "could not be read".
ALTER TYPE "IssueKind" ADD VALUE IF NOT EXISTS 'ExtraDocument';
ALTER TYPE "IssueKind" ADD VALUE IF NOT EXISTS 'DuplicateDocument';
