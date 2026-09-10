-- Until now a field on a document could only have been read off that document:
-- there was one origin and it was implicit, which is why nothing recorded it.
-- Two things the engine does make that untrue. A value the package prints on
-- five papers can close a field the sixth did not yield, and a value the
-- archive register holds the same record of has been agreed with by a source
-- outside the envelope. Both belong on the field, and neither is "read here"
-- (ADR-0023).
--
-- `pageNumber` loses its NOT NULL because a carried-over value has no sheet of
-- *this* document to cite. Null and not the source's sheet number: a client
-- turns this column into a page of the document the row hangs on, and a foreign
-- number here would open the wrong paper. Where the value came from rides in
-- the four `source*` columns instead, the sheet among them belonging to that
-- other document.
--
-- Every row that exists was read off its own document, which is exactly what
-- the default says, so the back-fill is the default and there is no UPDATE.
--
-- Its own migration with its own timestamp (COMM-47): a stamp shared with a
-- neighbour makes the order they are applied in a matter of luck.

-- CreateEnum
CREATE TYPE "FieldOrigin" AS ENUM ('ReadOnThisDocument', 'TakenFromAnotherDocument', 'ConfirmedByRegistry');

-- AlterTable
ALTER TABLE "extracted_fields" ADD COLUMN     "origin" "FieldOrigin" NOT NULL DEFAULT 'ReadOnThisDocument',
ADD COLUMN     "sourceDocumentId" UUID,
ADD COLUMN     "sourceDocumentType" TEXT,
ADD COLUMN     "sourceFieldName" TEXT,
ADD COLUMN     "sourcePageNumber" INTEGER,
ALTER COLUMN "pageNumber" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "extracted_fields_sourceDocumentId_idx" ON "extracted_fields"("sourceDocumentId");

-- AddForeignKey
ALTER TABLE "extracted_fields" ADD CONSTRAINT "extracted_fields_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
