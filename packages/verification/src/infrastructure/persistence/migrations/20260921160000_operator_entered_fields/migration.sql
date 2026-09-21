-- A fourth field origin, and the audit of who put it there (ADR-0033).
--
-- Until now every value on a document was the machine's: read off this paper,
-- carried over from a sister paper, or read here and agreed with by the archive
-- register. None of those is a person typing what the sheet in front of them
-- says, which is what an operator does when the scan was poor — and it has to
-- be its own origin rather than a corrected reading, because an inspector
-- reading the field needs to know it is not what the reader made of the page.
--
-- `EnteredByOperator` answers "was this read here" with yes, deliberately: a
-- person read the paper, so the value may be a side of a cross-document check,
-- may be what the register is asked about, and answers for the document it
-- hangs on. Were it anything else the correction would change nothing
-- downstream.
--
-- `editedByAccountId` is a plain column and not a foreign key: the account row
-- is in another context's database, so there is nothing in this one to point at
-- (ADR-0029). Not indexed, because nothing looks a field up by its editor — the
-- audit is read off the field an inspector is already looking at.
--
-- No back-fill. Every row that exists was put there by the machine, and both
-- audit columns are null on exactly those, which is what "nobody has touched
-- this" means.
--
-- Its own migration with its own timestamp (COMM-47): a stamp shared with a
-- neighbour makes the order they are applied in a matter of luck.

-- AlterEnum
ALTER TYPE "FieldOrigin" ADD VALUE IF NOT EXISTS 'EnteredByOperator';

-- AlterTable
ALTER TABLE "extracted_fields" ADD COLUMN     "editedByAccountId" UUID,
ADD COLUMN     "editedAt" TIMESTAMP(3);
