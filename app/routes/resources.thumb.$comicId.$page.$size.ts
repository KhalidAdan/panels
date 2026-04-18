import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import { Readable } from "node:stream";
import { requireUser } from "#app/lib/auth-utils.server";
import {
  ensureThumb,
  isThumbSize,
} from "#app/lib/thumbnails.server";
import type { Route } from "./+types/resources.thumb.$comicId.$page.$size";

export async function loader({ params, request }: Route.LoaderArgs) {
  await requireUser(request);

  const comicId = params.comicId;
  const pageIndex = Number(params.page);
  const sizeParam = params.size;

  if (!isThumbSize(sizeParam)) {
    throw new Response("Invalid size", { status: 400 });
  }
  if (!Number.isInteger(pageIndex) || pageIndex < 0) {
    throw new Response("Invalid page index", { status: 400 });
  }

  let absPath: string;
  try {
    absPath = await ensureThumb(comicId, pageIndex, sizeParam);
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error("[resources.thumb] generation failed", err);
    throw new Response("Failed to generate thumbnail", { status: 500 });
  }

  const stat = await fs.stat(absPath);

  const etag = `"t-${stat.size}-${Math.floor(stat.mtimeMs)}"`;

  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  const nodeStream = createReadStream(absPath);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;

  return new Response(webStream, {
    status: 200,
    headers: {
      "Content-Type": "image/webp",
      "Content-Length": String(stat.size),
      "Cache-Control": "private, max-age=31536000, immutable",
      ETag: etag,
    },
  });
}