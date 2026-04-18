-- CreateTable
CREATE TABLE "Comic" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "filePath" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "fileSize" BIGINT NOT NULL,
    "pageCount" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "series" TEXT,
    "issueNumber" TEXT,
    "volume" INTEGER,
    "year" INTEGER,
    "summary" TEXT,
    "publisher" TEXT,
    "writer" TEXT,
    "coverPage" INTEGER NOT NULL DEFAULT 0,
    "isManga" BOOLEAN NOT NULL DEFAULT false,
    "metadataJson" TEXT,
    "importedById" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Comic_importedById_fkey" FOREIGN KEY ("importedById") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReadingProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "comicId" TEXT NOT NULL,
    "currentPageIndex" INTEGER NOT NULL DEFAULT 0,
    "lastReadAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReadingProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ReadingProgress_comicId_fkey" FOREIGN KEY ("comicId") REFERENCES "Comic" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Comic_filePath_key" ON "Comic"("filePath");

-- CreateIndex
CREATE UNIQUE INDEX "Comic_fileHash_key" ON "Comic"("fileHash");

-- CreateIndex
CREATE INDEX "Comic_series_volume_issueNumber_idx" ON "Comic"("series", "volume", "issueNumber");

-- CreateIndex
CREATE INDEX "Comic_title_idx" ON "Comic"("title");

-- CreateIndex
CREATE INDEX "Comic_importedById_idx" ON "Comic"("importedById");

-- CreateIndex
CREATE INDEX "ReadingProgress_userId_lastReadAt_idx" ON "ReadingProgress"("userId", "lastReadAt");

-- CreateIndex
CREATE UNIQUE INDEX "ReadingProgress_userId_comicId_key" ON "ReadingProgress"("userId", "comicId");
