-- AlterTable
ALTER TABLE "pages" ADD COLUMN "imageContentType" TEXT;

-- Every page written before this column existed points at the uploaded file
-- itself: the split rendered no images, it recorded one page per document.
UPDATE "pages"
SET "imageContentType" = "documents"."contentType"
FROM "documents"
WHERE "pages"."documentId" = "documents"."id";

ALTER TABLE "pages" ALTER COLUMN "imageContentType" SET NOT NULL;
