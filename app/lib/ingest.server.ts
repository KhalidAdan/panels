import type { Comic } from "#app/generated/prisma/client";
import { openFromPath, readComicInfoXml } from "#app/lib/cbz.server";
import { buildFieldUpdates } from "#app/lib/comic-metadata.server";
import {
  decideCoverPage,
  isMangaRTL,
  parseComicInfoXml,
  type ComicInfo,
} from "#app/lib/comicinfo.server";
import {
  bindByComicVineId,
  isComicVineEnabled,
  matchComic,
  parseComicVineUrl,
} from "#app/lib/comicvine.server";
import { prisma } from "#app/lib/db.server";
import { env } from "#app/lib/env.server";
import { parseComicFilename } from "#app/lib/filename-parse";
import { warmCoverThumb } from "#app/lib/thumbnails.server";
import { IngestError, resolveLibraryPath } from "#app/lib/validate-cbz.server";
import { collectBytes, from, pipe, tap } from "@culvert/stream";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

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

    const pageRows = await probePages(archive);

    const comic = await prisma.$transaction(async (tx) => {
      const created = await tx.comic.create({
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
      if (pageRows.length > 0) {
        await tx.page.createMany({
          data: pageRows.map((row) => ({
            comicId: created.id,
            pageIndex: row.pageIndex,
            isWide: row.isWide,
            width: row.width ?? null,
            height: row.height ?? null,
          })),
        });
      }
      return created;
    });

    void warmCoverThumb(comic.id, comic.coverPage);

    // Phase 5: ComicVine enrichment. Also best-effort, also post-commit.
    void enrichFromComicVine(comic.id, {
      series: comic.series,
      issueNumber: comic.issueNumber,
      year: comic.year,
      comicInfoWebUrl: extractComicInfoWeb(comicInfo),
    });

    return { status: "created", comic };
  } finally {
    await archive.close();
  }
}

export async function hashFile(absPath: string): Promise<string> {
  const hash = createHash("sha256");
  const file = createReadStream(absPath);

  try {
    await pipe(
      from(file),
      tap((chunk: Buffer) => {
        hash.update(chunk);
      }),
      collectBytes(),
    );
  } finally {
    file.close();
  }
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

export async function enrichFromComicVine(
  comicId: string,
  seed: {
    series?: string | null;
    issueNumber?: string | null;
    year?: number | null;
    comicInfoWebUrl?: string | null;
  },
): Promise<void> {
  if (!isComicVineEnabled()) return;

  try {
    const existing = await prisma.comic.findUnique({ where: { id: comicId } });
    if (!existing) return;

    const directId = seed.comicInfoWebUrl
      ? parseComicVineUrl(seed.comicInfoWebUrl)
      : null;
    if (directId) {
      const result = await bindByComicVineId(directId);
      if (result && (result.volume || result.issue)) {
        const updates = buildFieldUpdates(existing, result);
        await prisma.comic.update({
          where: { id: comicId },
          data: updates,
        });
        return;
      }
    }

    if (!seed.series) return;
    const match = await matchComic({
      series: seed.series,
      issueNumber: seed.issueNumber ?? undefined,
      year: seed.year ?? undefined,
    });
    if (!match) return;

    const updates = buildFieldUpdates(existing, {
      volume: match.volume,
      issue: match.issue,
    });
    await prisma.comic.update({
      where: { id: comicId },
      data: updates,
    });
  } catch (err) {
    console.error(`[ingest] comicvine enrichment failed for ${comicId}`, err);
  }
}

function extractComicInfoWeb(info: ComicInfo | null): string | null {
  if (!info?.Web) return null;
  const urls = info.Web.split(/\s+/).filter(Boolean);
  const cv = urls.find((u) => /comicvine\.gamespot\.com/.test(u));
  return cv ?? urls[0] ?? null;
}

interface PageProbeRow {
  pageIndex: number;
  isWide: boolean;
  width?: number;
  height?: number;
}

async function probePages(
  archive: Awaited<ReturnType<typeof openFromPath>>,
): Promise<PageProbeRow[]> {
  const rows: PageProbeRow[] = [];
  for (let i = 0; i < archive.pageOrder.length; i++) {
    const entry = archive.pageOrder[i]!;
    try {
      const bytes = await pipe(archive.zip.source(entry), collectBytes());
      const meta = await sharp(Buffer.from(bytes), {
        failOn: "none",
      }).metadata();
      if (meta.width && meta.height) {
        rows.push({
          pageIndex: i,
          isWide: meta.width > meta.height,
          width: meta.width,
          height: meta.height,
        });
      } else {
        rows.push({ pageIndex: i, isWide: false });
      }
    } catch (err) {
      console.error(`[ingest] probe failed for page ${i}`, err);
      rows.push({ pageIndex: i, isWide: false });
    }
  }
  return rows;
}
