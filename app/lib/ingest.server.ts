import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import type { Comic } from "#app/generated/prisma/client";
import {
  openFromPath,
  readComicInfoXml,
} from "#app/lib/cbz.server";
import {
  decideCoverPage,
  isMangaRTL,
  parseComicInfoXml,
  type ComicInfo,
} from "#app/lib/comicinfo.server";
import { prisma } from "#app/lib/db.server";
import { env } from "#app/lib/env.server";
import { parseComicFilename } from "#app/lib/filename-parse";
import {
  IngestError,
  resolveLibraryPath,
} from "#app/lib/validate-cbz.server";

export interface IngestOptions {
  sourcePath: string;
  originalName: string;
  alreadyInLibrary?: boolean;
  importedById?: string | null;
}

export interface IngestResult {
  status: "created" | "duplicate";
  comic: Comic;
}

export async function ingestComic(
  options: IngestOptions,
): Promise<IngestResult> {
  const { sourcePath, originalName, alreadyInLibrary, importedById } = options;

  const fileHash = await hashFile(sourcePath);

  const existing = await prisma.comic.findUnique({ where: { fileHash } });
  if (existing) {
    return { status: "duplicate", comic: existing };
  }

  const archive = await openFromPath(sourcePath);

  try {
    if (archive.pageOrder.length === 0) {
      throw new IngestError(
        "no_images",
        `CBZ has no image entries: ${originalName}`,
      );
    }

    const comicInfoXml = await readComicInfoXml(archive);
    const comicInfo: ComicInfo | null = comicInfoXml
      ? parseComicInfoXml(comicInfoXml)
      : null;

    const parsedName = parseComicFilename(originalName);

    const title =
      comicInfo?.Title?.trim() ||
      parsedName.title ||
      parsedName.series ||
      originalName.replace(/\.cbz$/i, "");

    const series = comicInfo?.Series?.trim() || parsedName.series;
    const issueNumber =
      comicInfo?.Number?.toString().trim() || parsedName.issue;
    const volume = comicInfo?.Volume ?? parsedName.volume;
    const year = comicInfo?.Year ?? parsedName.year;
    const summary = comicInfo?.Summary?.trim() ?? null;
    const publisher = comicInfo?.Publisher?.trim() ?? null;
    const writer = comicInfo?.Writer?.trim() ?? null;

    const pageCount = archive.pageOrder.length;
    const coverPage = decideCoverPage(comicInfo, pageCount);
    const isManga = isMangaRTL(comicInfo);

    const ext = path.extname(originalName).toLowerCase() || ".cbz";
    const targetRelative = `${fileHash}${ext}`;
    const targetAbs = alreadyInLibrary
      ? sourcePath
      : path.join(env.LIBRARY_PATH, targetRelative);

    const storedPath = alreadyInLibrary
      ? path.relative(path.resolve(env.LIBRARY_PATH), path.resolve(sourcePath))
      : targetRelative;

    if (!alreadyInLibrary) {
      await fs.mkdir(path.dirname(targetAbs), { recursive: true });
      try {
        await fs.rename(sourcePath, targetAbs);
      } catch (err: unknown) {
        if (
          err &&
          typeof err === "object" &&
          "code" in err &&
          (err as { code: string }).code === "EXDEV"
        ) {
          await fs.copyFile(sourcePath, targetAbs);
          await fs.rm(sourcePath, { force: true });
        } else {
          throw err;
        }
      }
    }

    const comic = await prisma.comic.create({
      data: {
        filePath: storedPath,
        fileHash,
        fileSize: BigInt(archive.fileSize),
        pageCount,
        title,
        series: series ?? null,
        issueNumber: issueNumber ?? null,
        volume: volume ?? null,
        year: year ?? null,
        summary,
        publisher,
        writer,
        coverPage,
        isManga,
        metadataJson: comicInfoXml ? JSON.stringify({ comicInfo }) : null,
        importedById: importedById ?? null,
      },
    });

    return { status: "created", comic };
  } finally {
    await archive.close();
  }
}

export async function hashFile(absPath: string): Promise<string> {
  const hash = createHash("sha256");
  await pipeline(createReadStream(absPath), hash);
  return hash.digest("hex");
}

export async function walkLibraryForCbz(): Promise<string[]> {
  const root = resolveLibraryPath(".");
  const results: string[] = [];

  async function walk(dir: string): Promise<void> {
    let entries: import("node:fs").Dirent[];
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(full);
      } else if (entry.isFile() && /\.cbz$/i.test(entry.name)) {
        results.push(full);
      }
    }
  }

  await walk(root);
  return results;
}