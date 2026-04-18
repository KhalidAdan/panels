export const DEFAULT_MAX_UPLOAD_SIZE = 4 * 1024 * 1024 * 1024; // 4 GB

export const DEFAULT_MAX_FILE_SIZE = 4 * 1024 * 1024 * 1024; // 4 GB

export const INGEST_LIMITS = {
  maxEntries: 2000,
  maxTotalUncompressed: 4 * 1024 * 1024 * 1024,
  maxEntrySize: 500 * 1024 * 1024,
  maxCompressionRatio: 1000,
  maxFileSize: DEFAULT_MAX_FILE_SIZE,
} as const;

export const IMAGE_EXTENSIONS = new Set([
  ".jpg", ".jpeg", ".png", ".webp", ".gif", ".avif", ".jxl", ".bmp", ".tiff",
]);