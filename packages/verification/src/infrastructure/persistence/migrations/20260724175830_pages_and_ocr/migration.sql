-- CreateTable
CREATE TABLE "ocr_results" (
    "id" UUID NOT NULL,
    "pageId" UUID NOT NULL,
    "text" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "boxes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ocr_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pages" (
    "id" UUID NOT NULL,
    "documentId" UUID NOT NULL,
    "pageNumber" INTEGER NOT NULL,
    "imageStorageKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ocr_results_pageId_key" ON "ocr_results"("pageId");

-- CreateIndex
CREATE UNIQUE INDEX "pages_documentId_pageNumber_key" ON "pages"("documentId", "pageNumber");

-- AddForeignKey
ALTER TABLE "ocr_results" ADD CONSTRAINT "ocr_results_pageId_fkey" FOREIGN KEY ("pageId") REFERENCES "pages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pages" ADD CONSTRAINT "pages_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
