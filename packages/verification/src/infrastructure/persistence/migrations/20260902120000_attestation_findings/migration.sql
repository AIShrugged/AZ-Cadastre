-- A paper an office issues is only itself once that office has sealed and
-- signed it, and a package can carry every required document and still be
-- short of what makes one of them valid. That is neither an absent document
-- nor a sheet that could not be read, so it is told under its own name.
ALTER TYPE "IssueKind" ADD VALUE IF NOT EXISTS 'MissingAttestation';
