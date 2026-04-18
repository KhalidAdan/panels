import "dotenv/config";
import sharp from "sharp";
import { pipe, collectBytes } from "@culvert/stream";
import { prisma } from "../app/lib/db.server";
import { openFromPath } from "../app/lib/cbz.server";
import { env } from "../app/lib/env.server";
import { resolveLibraryPath } from "../app/lib/validate-cbz.server";
import path from "node:path";

async function main() {
  const comics = await prisma.comic.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { pages: true } } },
  });

  console.log(`[backfill] ${comics.length} comics to check`);

  for (const comic of comics) {
    if (comic._count.pages === comic.pageCount) {
      console.log(`[backfill] skip ${comic.id} (already ${comic._count.pages} pages)`);
      continue;
    }

    const abs = resolveLibraryPath(comic.filePath);
    console.log(`[backfill] process ${comic.id} ${path.basename(abs)}`);

    let archive;
    try {
      archive = await openFromPath(abs);
    } catch (err) {
      console.error(`[backfill] open failed for ${comic.id}`, err);
      continue;
    }

    try {
      await prisma.page.deleteMany({ where: { comicId: comic.id } });
      for (let i = 0; i < archive.pageOrder.length; i++) {
        const entry = archive.pageOrder[i]!;
        const isWide = await detectWide(archive, entry);
        await prisma.page.create({
          data: {
            comicId: comic.id,
            pageIndex: i,
            isWide: isWide.isWide,
            width: isWide.width,
            height: isWide.height,
          },
        });
      }
      console.log(`[backfill] ${comic.id} done`);
    } finally {
      await archive.close();
    }
  }

  await prisma.$disconnect();
}

async function detectWide(
  archive: Awaited<ReturnType<typeof openFromPath>>,
  entry: Parameters<typeof archive.zip.source>[0],
): Promise<{ isWide: boolean; width?: number; height?: number }> {
  try {
    const bytes = await pipe(archive.zip.source(entry), collectBytes());
    const meta = await sharp(Buffer.from(bytes), { failOn: "none" }).metadata();
    if (!meta.width || !meta.height) return { isWide: false };
    return {
      isWide: meta.width > meta.height,
      width: meta.width,
      height: meta.height,
    };
  } catch {
    return { isWide: false };
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});