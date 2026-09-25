-- The span working is drawn onto the sheets it was read off, and the drawing is
-- kept (COMM-165).
--
-- A span reaches an inspector as a number and a string of axis pairs, and
-- neither can be checked against the drawing on the desk: a case was decided in
-- production on a chain no sheet carries (COMM-160). The markup is the check —
-- the rooms outlined, their walls lettered and dimensioned, the axes drawn where
-- the set marks any — and these two tables are where the pictures are kept.
--
-- On the document and not beside the span calculation, deliberately: the picture
-- is worth the most exactly when the calculation refused, and then there is no
-- calculation row for it to hang on.
--
-- Nothing is backfilled. A markup is drawn by the run that reads the paper, so
-- packages verified before this migration have none until they are verified
-- again, and the contract publishes null for them — which is the same answer it
-- publishes for every paper that is not a design set.
CREATE TABLE "span_markups" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "unit" TEXT,
    "unitBasis" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "span_markups_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "span_markup_sheets" (
    "id" UUID NOT NULL,
    "spanMarkupId" UUID NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "imageStorageKey" TEXT NOT NULL,
    "imageContentType" TEXT NOT NULL,
    "rooms" INTEGER NOT NULL,
    "axes" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,

    CONSTRAINT "span_markup_sheets_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "span_markups_documentId_key" ON "span_markups"("documentId");

CREATE INDEX "span_markup_sheets_spanMarkupId_idx" ON "span_markup_sheets"("spanMarkupId");

ALTER TABLE "span_markups" ADD CONSTRAINT "span_markups_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "span_markup_sheets" ADD CONSTRAINT "span_markup_sheets_spanMarkupId_fkey" FOREIGN KEY ("spanMarkupId") REFERENCES "span_markups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
