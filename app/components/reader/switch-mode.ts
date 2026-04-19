import type { ReaderMode } from "#app/lib/reader-prefs";

/**
 * Persist the reader mode preference and reload the page so the server
 * re-renders with the new mode. Simpler than juggling fetcher revalidation.
 */
export async function switchReaderMode(mode: ReaderMode): Promise<void> {
  try {
    await fetch("/resources/prefs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ readerMode: mode }),
    });
  } finally {
    window.location.reload();
  }
}