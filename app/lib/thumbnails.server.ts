import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import sharp from "sharp";
import { pipe, collectBytes } from "@culvert/stream";
import { acquire, release } from "#app/lib/archive-cache.server";
import { env } from "#app/lib/env.server";

export type ThumbSize = "strip" | "card" | "reader";

export const THUMB_SIZES: Record<
  ThumbSize,
  { width: number; height: number | null; quality: number }
> = {
  strip: { width: 100, height: 150, quality: 75 },
  card: { width: 240, height: 360, quality: 80 },
  reader: { width: 2048, height: null, quality: 82 },
};

export function isThumbSize(s: string): s is ThumbSize {
  return s === "strip" || s === "card" || s === "reader";
}

export function thumbPath(
  comicId: string,
  pageIndex: number,
  size: ThumbSize,
): string {
  return path.join(
    path.resolve(env.CACHE_PATH),
    "thumb",
    comicId,
    `p${pageIndex}-${size}.webp`,
  );
}

const inflight = new Map<string, Promise<string>>();

function inflightKey(
  comicId: string,
  pageIndex: number,
  size: ThumbSize,
): string {
  return `${comicId}:${pageIndex}:${size}`;
}

export async function ensureThumb(
  comicId: string,
  pageIndex: number,
  size: ThumbSize,
): Promise<string> {
  const out = thumbPath(comicId, pageIndex, size);

  try {
    await fs.access(out);
    return out;
  } catch {
    // Fall through to generation.
  }

  const key = inflightKey(comicId, pageIndex, size);
  const pending = inflight.get(key);
  if (pending) return pending;

  const promise = generateThumb(comicId, pageIndex, size, out)
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, promise);
  return promise;
}

async function generateThumb(
  comicId: string,
  pageIndex: number,
  size: ThumbSize,
  outPath: string,
): Promise<string> {
  const archive = await acquire(comicId);
  try {
    const entry = archive.pageOrder[pageIndex];
    if (!entry) {
      throw new Response("Page out of range", { status: 404 });
    }

    const bytes = await pipe(archive.zip.source(entry), collectBytes());

    const { width, height, quality } = THUMB_SIZES[size];
    const sharpPipeline = sharp(Buffer.from(bytes), {
      failOn: "none",
    }).resize({
      width,
      height: height ?? undefined,
      fit: "inside",
      withoutEnlargement: true,
    });

    let webp: Buffer;
    try {
      webp = await sharpPipeline.webp({ quality, effort: 4 }).toBuffer();
    } catch (err) {
      console.error(
        `[thumbnails] webp failed for ${comicId} p${pageIndex} ${size}`,
        err,
      );
      webp = await sharp(Buffer.from(bytes), { failOn: "none" })
        .resize({
          width,
          height: height ?? undefined,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({ quality })
        .toBuffer();
    }

    await fs.mkdir(path.dirname(outPath), { recursive: true });
    const tmp = `${outPath}.${process.pid}.${Date.now()}.tmp`;
    await fs.writeFile(tmp, webp);
    await fs.rename(tmp, outPath);
    return outPath;
  } finally {
    release(comicId);
  }
}

export async function removeAllThumbs(comicId: string): Promise<void> {
  const dir = path.join(path.resolve(env.CACHE_PATH), "thumb", comicId);
  try {
    await fs.rm(dir, { recursive: true, force: true });
  } catch (err) {
    console.error(`[thumbnails] cleanup failed for ${comicId}`, err);
  }
}

export async function warmCoverThumb(
  comicId: string,
  coverPage: number,
): Promise<void> {
  try {
    await ensureThumb(comicId, coverPage, "card");
  } catch (err) {
    console.error(`[thumbnails] warm cover failed for ${comicId}`, err);
  }
}