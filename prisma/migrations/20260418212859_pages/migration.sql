-- CreateTable
CREATE TABLE "Page" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "comicId" TEXT NOT NULL,
    "pageIndex" INTEGER NOT NULL,
    "isWide" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT,
    "width" INTEGER,
    "height" INTEGER,
    CONSTRAINT "Page_comicId_fkey" FOREIGN KEY ("comicId") REFERENCES "Comic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Page_comicId_idx" ON "Page"("comicId");

-- CreateIndex
CREATE UNIQUE INDEX "Page_comicId_pageIndex_key" ON "Page"("comicId", "pageIndex");
