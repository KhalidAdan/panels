import { IMAGE_EXTENSIONS, INGEST_LIMITS } from "#app/lib/constants";
import { env } from "#app/lib/env.server";
import path from "node:path";

export { INGEST_LIMITS } from "#app/lib/constants";

export function isImageFilename(name: string): boolean {
  const ext = path.extname(name).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

export function isComicInfoFilename(name: string): boolean {
  return path.basename(name).toLowerCase() === "comicinfo.xml";
}

export class IngestError extends Error {
  constructor(
    public kind:
      | "too_many_entries"
      | "archive_too_large"
      | "entry_too_large"
      | "zip_bomb"
      | "encrypted"
      | "path_traversal"
      | "absolute_path"
      | "null_byte"
      | "invalid_name"
      | "no_images"
      | "not_a_zip"
      | "duplicate"
      | "filesystem",
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "IngestError";
  }
}

export function validateEntryName(name: string): void {
  if (name.length === 0 || name.length > 1024) {
    throw new IngestError("invalid_name", `Invalid entry name: ${name}`);
  }
  if (name.includes("\0")) {
    throw new IngestError("null_byte", `Entry name contains null byte: ${name}`);
  }
  if (/^(\/|[A-Za-z]:[\\/])/.test(name)) {
    throw new IngestError("absolute_path", `Absolute path: ${name}`);
  }
  const parts = name.split(/[\\/]/);
  if (parts.includes("..")) {
    throw new IngestError("path_traversal", `Path traversal: ${name}`);
  }
}

export function validateEntryMetadata(entry: {
  fileName: string;
  uncompressedSize: number;
  compressedSize: number;
  generalPurposeBitFlag?: number;
}): void {
  validateEntryName(entry.fileName);

  if (
    typeof entry.generalPurposeBitFlag === "number" &&
    (entry.generalPurposeBitFlag & 0x1) !== 0
  ) {
    throw new IngestError(
      "encrypted",
      `Encrypted entry not supported: ${entry.fileName}`,
    );
  }

  if (entry.uncompressedSize > INGEST_LIMITS.maxEntrySize) {
    throw new IngestError(
      "entry_too_large",
      `Entry exceeds ${INGEST_LIMITS.maxEntrySize} bytes: ${entry.fileName}`,
      { uncompressedSize: entry.uncompressedSize },
    );
  }

  if (entry.compressedSize > 0) {
    const ratio = entry.uncompressedSize / entry.compressedSize;
    if (ratio > INGEST_LIMITS.maxCompressionRatio) {
      throw new IngestError(
        "zip_bomb",
        `Suspicious compression ratio ${ratio.toFixed(0)}:1: ${entry.fileName}`,
        { ratio, compressed: entry.compressedSize, uncompressed: entry.uncompressedSize },
      );
    }
  }
}

export function resolveLibraryPath(relative: string): string {
  const libRoot = path.resolve(env.LIBRARY_PATH);
  const abs = path.resolve(libRoot, relative);
  const withSep = libRoot + path.sep;
  if (abs !== libRoot && !abs.startsWith(withSep)) {
    throw new IngestError(
      "path_traversal",
      `Path escapes library: ${relative}`,
      { resolved: abs, root: libRoot },
    );
  }
  return abs;
}

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});

export function naturalSort<T>(items: T[], keyFn: (x: T) => string): T[] {
  return [...items].sort((a, b) => collator.compare(keyFn(a), keyFn(b)));
}