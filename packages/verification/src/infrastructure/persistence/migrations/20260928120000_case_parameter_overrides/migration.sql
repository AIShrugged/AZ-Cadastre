-- The six figures of the Article 8 table, settable by an operator (COMM-193).
--
-- Until now the table was read on nothing but what the papers were read to say,
-- and there was no way to correct a figure. Correcting the field it is printed
-- on cannot do the job: a parameter may have no reading at all, the right over
-- the land comes from the kind of title document rather than any line of one,
-- and the span is calculated out of the axis chains, so no single field carries
-- it.
--
-- The figure and never the provision it selects. The table goes on being read
-- on every read and is stored nowhere (ADR-0014); what is stored here is an
-- input, because an input is the only thing a person can supply.
--
-- A row per figure an operator has set, and the absence of a row is the figure
-- standing as the papers say. Clearing an override deletes the row rather than
-- writing a null: "nothing was set" and "nothing was set on purpose" are the
-- same statement about the case.
--
-- `editedByAccountId` is a plain column and not a foreign key, exactly as it is
-- on a corrected field: the account row lives in another context's database, so
-- there is nothing in this one to point at (ADR-0029). Not indexed — nothing
-- looks an override up by its editor.
--
-- No back-fill and nothing to back-fill: every package that exists was decided
-- on its papers, and that is what an empty table means.
--
-- Its own migration with its own timestamp (COMM-47): a stamp shared with a
-- neighbour makes the order they are applied in a matter of luck.

-- CreateEnum
CREATE TYPE "CaseParameter" AS ENUM ('builtYear', 'storeys', 'height', 'span', 'landRight', 'purpose');

-- CreateTable
CREATE TABLE "case_parameter_overrides" (
    "id" UUID NOT NULL,
    "packageId" UUID NOT NULL,
    "parameter" "CaseParameter" NOT NULL,
    "value" TEXT NOT NULL,
    "editedByAccountId" UUID NOT NULL,
    "editedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_parameter_overrides_pkey" PRIMARY KEY ("id")
);

-- One override per figure per package: two rows for one figure would make the
-- case depend on which of them was read last.
-- CreateIndex
CREATE UNIQUE INDEX "case_parameter_overrides_packageId_parameter_key" ON "case_parameter_overrides"("packageId", "parameter");

-- AddForeignKey
ALTER TABLE "case_parameter_overrides" ADD CONSTRAINT "case_parameter_overrides_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "verification_packages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
