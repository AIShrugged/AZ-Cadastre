-- Why a markup is short, as reasons rather than as an English sentence
-- (COMM-170).
--
-- `span_markups.note` held a sentence the drawing stage assembled in English
-- and the contract published as it stood, so a Russian or an Azerbaijani
-- inspector read "No axis circles" on their own screen (COMM-166). The four
-- clauses it was ever built from are a closed list, exactly as a refused span
-- calculation's `refusedFor` is, so they move to rows a client can translate.
--
-- The old column is dropped and nothing is carried over. A sentence cannot be
-- taken apart into the reasons that built it with any confidence, and a markup
-- is redrawn whole by the run that reads the paper — so a package verified
-- before this migration publishes no reasons until it is verified again, which
-- is the same answer it already gives for a picture it has never had.
ALTER TABLE "span_markups" DROP COLUMN "note";

CREATE TABLE "span_markup_notes" (
    "id" UUID NOT NULL,
    "spanMarkupId" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "sheets" INTEGER,
    "position" INTEGER NOT NULL,

    CONSTRAINT "span_markup_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "span_markup_notes_spanMarkupId_idx" ON "span_markup_notes"("spanMarkupId");

ALTER TABLE "span_markup_notes" ADD CONSTRAINT "span_markup_notes_spanMarkupId_fkey" FOREIGN KEY ("spanMarkupId") REFERENCES "span_markups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
