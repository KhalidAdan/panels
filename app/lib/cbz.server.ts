import {
  INGEST_LIMITS,
  IngestError,
  isComicInfoFilename,
  isImageFilename,
  naturalSort,
  validateEntryMetadata,
} from "#app/lib/validate-cbz.server";
import { collectBytes, pipe } from "@culvert/stream";
import type {
  OpenZipArchive,
  ZipDirectoryEntry,
  ZipSeekable,
} from "@culvert/zip";
import { openZip } from "@culvert/zip";
import { open as fsOpen, type FileHandle } from "node:fs/promises";

export interface OpenedArchive {
  zip: OpenZipArchive;
  fileHandle: FileHandle;
  entries: Map<string, ZipDirectoryEntry>;
  pageOrder: ZipDirectoryEntry[];
  comicInfoEntry: ZipDirectoryEntry | undefined;
  absPath: string;
  fileSize: number;
  close: () => Promise<void>;
}

function seekableFromHandle(handle: FileHandle, size: number): ZipSeekable {
  return {
    size,
    read: async (offset: number, length: number) => {
      const buf = new Uint8Array(length);
      const { bytesRead } = await handle.read(buf, 0, length, offset);
      return buf.subarray(0, bytesRead);
    },
    close: async () => {
      await handle.close();
    },
  };
}

export async function openFromPath(absPath: string): Promise<OpenedArchive> {
  const handle = await fsOpen(absPath, "r");
  let stat: Awaited<ReturnType<FileHandle["stat"]>>;
  try {
    stat = await handle.stat();
  } catch (err) {
    await handle.close();
    throw err;
  }

  if (stat.size > INGEST_LIMITS.maxFileSize) {
    await handle.close();
    throw new IngestError(
      "archive_too_large",
      `CBZ exceeds ${INGEST_LIMITS.maxFileSize} bytes`,
      { size: stat.size },
    );
  }

  const seekable = seekableFromHandle(handle, stat.size);

  let zip: OpenZipArchive;
  try {
    zip = await openZip(seekable);
  } catch (err) {
    await handle.close();
    throw new IngestError(
      "not_a_zip",
      `Failed to open zip: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const entries = new Map<string, ZipDirectoryEntry>();
  let totalUncompressed = 0;
  for (const entry of zip.entries) {
    const fileName = entry.name;
    if (!fileName || fileName.endsWith("/")) continue;
    validateEntryMetadata({
      fileName,
      uncompressedSize: entry.uncompressedSize,
      compressedSize: entry.compressedSize,
    });
    totalUncompressed += entry.uncompressedSize;
    if (totalUncompressed > INGEST_LIMITS.maxTotalUncompressed) {
      await zip.close();
      throw new IngestError(
        "zip_bomb",
        `Total uncompressed size exceeds ${INGEST_LIMITS.maxTotalUncompressed} bytes`,
        { total: totalUncompressed },
      );
    }
    entries.set(fileName, entry);
  }

  if (entries.size > INGEST_LIMITS.maxEntries) {
    await zip.close();
    throw new IngestError(
      "too_many_entries",
      `Archive has ${entries.size} entries (max ${INGEST_LIMITS.maxEntries})`,
    );
  }

  const images = [...entries.values()].filter((e) => {
    const name = (e as unknown as { name?: string }).name;
    return name && isImageFilename(name);
  });
  const pageOrder = naturalSort(
    images,
    (e) => (e as unknown as { name?: string }).name || "",
  );

  const comicInfoEntry = [...entries.values()].find((e) => {
    const name = (e as unknown as { name?: string }).name;
    return name && isComicInfoFilename(name);
  });

  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    await zip.close();
  };

  return {
    zip,
    fileHandle: handle,
    entries,
    pageOrder,
    comicInfoEntry,
    absPath,
    fileSize: stat.size,
    close,
  };
}

export async function readEntryBytes(
  archive: OpenedArchive,
  entry: ZipDirectoryEntry,
): Promise<Uint8Array> {
  return pipe(archive.zip.source(entry), collectBytes());
}

export async function readComicInfoXml(
  archive: OpenedArchive,
): Promise<string | null> {
  if (!archive.comicInfoEntry) return null;
  const bytes = await readEntryBytes(archive, archive.comicInfoEntry);
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}
