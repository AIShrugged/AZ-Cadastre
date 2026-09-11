-- Targeted supply of a document (COMM-80).
--
-- Until now a file could only be added to a package: it joined the envelope and
-- the package had no idea what hole, if any, it was answering. An operator who
-- sent a better scan of an unreadable technical passport got one more document
-- beside the bad one, and the finding they were answering stayed in the report
-- with nothing connecting the two.
--
-- Three things this needs on file.
--
-- `source_files.suppliedForType` / `suppliedForReplaces` are what the operator
-- said the file is for: the profile document type it is supposed to turn out to
-- be, and the document it replaces where it is a replacement. The second is a
-- bare uuid and not a foreign key, for the reason an archive-search approval
-- keeps its check keys as strings — it records what was asked for at the moment
-- of upload and has to stay readable whatever later becomes of the document it
-- named. Both null on every existing row, which is exactly what they mean: a
-- file that answers nothing in particular.
--
-- `documents.supersededById` / `supersededAt` are the replacement itself. A
-- replaced document is never deleted — a submission is evidence and not a
-- working draft — so it stays in the package, marked, saying what replaced it
-- and when. Everything worked out about the package reads only the rows with
-- `supersededAt` null. SetNull on the self-reference because the pointer is for
-- the reader: losing it must not take the record of the replacement with it.
--
-- `WrongDocumentSupplied` is the finding for a file sent in against a gap that
-- turned out to be a different paper. Not `ExtraDocument`, which is a paper
-- that simply arrived: this one was sent in answer to something, and the answer
-- does not fit.
--
-- Nothing is back-filled. Every row that exists predates targeted supply, and
-- null on all four columns is the truthful record of that.

-- AlterEnum
ALTER TYPE "IssueKind" ADD VALUE 'WrongDocumentSupplied';

-- AlterTable
ALTER TABLE "source_files" ADD COLUMN     "suppliedForType" TEXT,
ADD COLUMN     "suppliedForReplaces" UUID;

-- AlterTable
ALTER TABLE "documents" ADD COLUMN     "supersededById" UUID,
ADD COLUMN     "supersededAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "documents_supersededById_idx" ON "documents"("supersededById");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_supersededById_fkey" FOREIGN KEY ("supersededById") REFERENCES "documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
