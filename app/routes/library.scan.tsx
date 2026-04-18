import { redirect } from "react-router";
import { requireUser } from "#app/lib/auth-utils.server";
import { hashFile, ingestComic, walkLibraryForCbz } from "#app/lib/ingest.server";
import { prisma } from "#app/lib/db.server";
import { IngestError } from "#app/lib/validate-cbz.server";

export async function loader() {
  throw redirect("/library");
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);

  const files = await walkLibraryForCbz();
  let added = 0;
  let skipped = 0;
  let failed = 0;
  const failures: Array<{ path: string; kind: string; message: string }> = [];

  for (const file of files) {
    try {
      const fileHash = await hashFile(file);
      const existing = await prisma.comic.findUnique({ where: { fileHash } });
      if (existing) {
        skipped++;
        continue;
      }

      const result = await ingestComic({
        sourcePath: file,
        originalName: file,
        alreadyInLibrary: true,
        importedById: user.id,
      });

      if (result.status === "duplicate") skipped++;
      else added++;
    } catch (err) {
      failed++;
      if (err instanceof IngestError) {
        failures.push({ path: file, kind: err.kind, message: err.message });
      } else {
        failures.push({
          path: file,
          kind: "unknown",
          message: err instanceof Error ? err.message : String(err),
        });
        console.error("[scan]", file, err);
      }
    }
  }

  const query = new URLSearchParams({
    scanned: String(files.length),
    added: String(added),
    skipped: String(skipped),
    failed: String(failed),
  });
  return redirect(`/library?${query.toString()}`);
}