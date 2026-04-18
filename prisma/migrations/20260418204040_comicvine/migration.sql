-- AlterTable
ALTER TABLE "Comic" ADD COLUMN "comicvineId" TEXT;

-- CreateTable
CREATE TABLE "ComicVineCache" (
    "cacheKey" TEXT NOT NULL PRIMARY KEY,
    "payload" TEXT NOT NULL,
    "fetchedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "ComicVineCache_expiresAt_idx" ON "ComicVineCache"("expiresAt");
