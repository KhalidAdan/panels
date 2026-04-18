import { Button } from "#app/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#app/components/ui/card";
import { Input } from "#app/components/ui/input";
import { Label } from "#app/components/ui/label";
import { requireUser } from "#app/lib/auth-utils.server";
import { DEFAULT_MAX_UPLOAD_SIZE } from "#app/lib/constants";
import { env } from "#app/lib/env.server";
import { ingestComic } from "#app/lib/ingest.server.js";
import { IngestError } from "#app/lib/validate-cbz.server.js";
import { fromReadableStream, pipe, writeTo } from "@culvert/stream";
import { type FileUpload, parseFormData } from "@mjackson/form-data-parser";
import crypto from "node:crypto";
import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { Writable } from "node:stream";
import { Form, Link, data, redirect } from "react-router";
import type { Route } from "./+types/upload";

const MAX_UPLOAD_BYTES = env.MAX_UPLOAD_SIZE ?? DEFAULT_MAX_UPLOAD_SIZE;
const MAX_FILE_SIZE = env.MAX_UPLOAD_SIZE ?? DEFAULT_MAX_UPLOAD_SIZE;

async function* countBytes(
  source: AsyncIterable<Uint8Array>,
  onProgress: (bytes: number) => void,
): AsyncIterable<Uint8Array> {
  for await (const chunk of source) {
    onProgress(chunk.byteLength);
    yield chunk;
  }
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);

  await fs.mkdir(env.UPLOAD_TEMP_PATH, { recursive: true });

  let tempPath: string | null = null;
  let originalName: string | null = null;
  let receivedBytes = 0;

  async function uploadHandler(upload: FileUpload) {
    if (upload.fieldName !== "comic") return;

    const name = upload.name ?? "upload.cbz";
    const lower = name.toLowerCase();
    const type = (upload.type ?? "").toLowerCase();

    const looksLikeCbz =
      lower.endsWith(".cbz") ||
      type === "application/zip" ||
      type === "application/x-zip-compressed" ||
      type === "application/vnd.comicbook+zip";

    if (!looksLikeCbz) {
      throw new Response("Only .cbz (ZIP) files are supported in this MVP.", {
        status: 400,
      });
    }

    const dest = path.join(
      env.UPLOAD_TEMP_PATH,
      `upload-${crypto.randomUUID()}.cbz`,
    );

    const source = fromReadableStream(upload.stream());

    const counted = countBytes(source, (chunkLen) => {
      receivedBytes += chunkLen;
      if (receivedBytes > MAX_UPLOAD_BYTES) {
        throw new Response(`Upload exceeds ${MAX_UPLOAD_BYTES} bytes`, {
          status: 413,
        });
      }
    });

    const writable = createWriteStream(dest);

    // No node stream bridges, maybe they are needed...
    await pipe(counted, writeTo(Writable.toWeb(writable)));

    tempPath = dest;
    originalName = name;
  }

  try {
    await parseFormData(request, { maxFileSize: MAX_FILE_SIZE }, uploadHandler);
  } catch (err) {
    if (tempPath) await fs.rm(tempPath, { force: true });
    if (err instanceof Response) throw err;
    throw err;
  }

  if (!tempPath || !originalName) {
    return data(
      { error: "No file received. Please select a .cbz file." },
      { status: 400 },
    );
  }

  try {
    const result = await ingestComic({
      sourcePath: tempPath,
      originalName,
      alreadyInLibrary: false,
      importedById: user.id,
    });

    if (result.status === "duplicate") {
      await fs.rm(tempPath, { force: true }).catch(() => {});
      return redirect(`/comics/${result.comic.id}?dup=1`);
    }

    return redirect(`/comics/${result.comic.id}`);
  } catch (err) {
    await fs.rm(tempPath, { force: true }).catch(() => {});
    if (err instanceof IngestError) {
      return data(
        { error: `Ingest failed (${err.kind}): ${err.message}` },
        { status: 400 },
      );
    }
    console.error("[upload] unexpected", err);
    return data(
      { error: "Unexpected error during import. Check server logs." },
      { status: 500 },
    );
  }
}

export default function Upload({ actionData }: Route.ComponentProps) {
  const error =
    actionData && "error" in actionData ? actionData.error : undefined;

  return (
    <div className="container mx-auto flex min-h-screen max-w-xl flex-col gap-6 p-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Upload a comic</h1>
        <Button asChild variant="ghost">
          <Link to="/library">Back to library</Link>
        </Button>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Add a CBZ</CardTitle>
          <CardDescription>
            Select a .cbz file. Metadata is read from ComicInfo.xml (if present)
            or parsed from the filename.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form
            method="post"
            encType="multipart/form-data"
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="comic">Comic file</Label>
              <Input
                id="comic"
                name="comic"
                type="file"
                accept=".cbz,application/zip,application/vnd.comicbook+zip"
                required
              />
            </div>

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            <Button type="submit">Upload</Button>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
