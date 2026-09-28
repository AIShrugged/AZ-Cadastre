-- A check that compared nothing is no longer a confirmation of the paper
-- (ADR-0048).
--
-- The archive's electronic document service verifies the signature on the file
-- it serves and states nothing about what the paper says, so a check whose eight
-- lines were all `NotStated`, `NotCompared` or `NotRead` came out `Confirmed` on
-- the strength of that signature alone: the report headed itself "the archive's
-- copy bears this paper out" over a comparison nobody had made. `SignatureOnly`
-- is that state said in its own word.
ALTER TYPE "ArchiveQrCheckStatus" ADD VALUE IF NOT EXISTS 'SignatureOnly';
