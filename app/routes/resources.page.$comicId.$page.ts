import { toReadableStream } from "@culvert/stream";
import { acquire, release } from "#app/lib/archive-cache.server";
import { requireUser } from "#app/lib/auth-utils.server";
import { mimeForFilename } from "#app/lib/image-mime";
import type { Route } from "./+types/resources.page.$comicId.$page";

export async function loader({ params, request }: Route.LoaderArgs) {
  await requireUser(request);

  const comicId = params.comicId;
  const pageIndex = Number(params.page);
  if (!Number.isInteger(pageIndex) || pageIndex < 0) {
    throw new Response("Invalid page index", { status: 400 });
  }

  const archive = await acquire(comicId);

  let released = false;
  const doRelease = () => {
    if (released) return;
    released = true;
    release(comicId);
  };

  try {
    const entry = archive.pageOrder[pageIndex];
    if (!entry) {
      doRelease();
      throw new Response("Page out of range", { status: 404 });
    }

    const webStream = toReadableStream(archive.zip.source(entry));

    const tapped = new ReadableStream<Uint8Array>({
      async start(controller) {
        const reader = webStream.getReader();
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
          controller.close();
        } catch (err) {
          controller.error(err);
        } finally {
          doRelease();
        }
      },
      cancel() {
        void (async () => {
          try {
            await webStream.cancel();
          } finally {
            doRelease();
          }
        })();
      },
    });

    const headers = new Headers({
      "Content-Type": mimeForFilename(entry.name),
      "Content-Length": String(entry.uncompressedSize),
      "Cache-Control": "private, max-age=3600",
      "Accept-Ranges": "none",
    });

    return new Response(tapped, { status: 200, headers });
  } catch (err) {
    doRelease();
    if (err instanceof Response) throw err;
    console.error("[resources.page] unexpected", err);
    throw new Response("Internal error", { status: 500 });
  }
}