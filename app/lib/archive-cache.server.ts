import path from "node:path";
import { openFromPath, type OpenedArchive } from "#app/lib/cbz.server";
import { prisma } from "#app/lib/db.server";
import { env } from "#app/lib/env.server";
import { resolveLibraryPath } from "#app/lib/validate-cbz.server";

interface Entry {
  archive: OpenedArchive;
  refCount: number;
  lastUsed: number;
  pendingEvict: Array<() => void>;
}

const CAPACITY = 20;
const store = new Map<string, Entry>();
const pending = new Map<string, Promise<OpenedArchive>>();

export async function acquire(comicId: string): Promise<OpenedArchive> {
  const cached = store.get(comicId);
  if (cached) {
    cached.refCount++;
    cached.lastUsed = Date.now();
    return cached.archive;
  }

  const inflight = pending.get(comicId);
  if (inflight) {
    await inflight;
    return acquire(comicId);
  }

  const promise = openComicArchive(comicId);
  pending.set(comicId, promise);
  try {
    const archive = await promise;
    store.set(comicId, {
      archive,
      refCount: 1,
      lastUsed: Date.now(),
      pendingEvict: [],
    });
    evictIfNeeded();
    return archive;
  } finally {
    pending.delete(comicId);
  }
}

export function release(comicId: string): void {
  const entry = store.get(comicId);
  if (!entry) return;
  entry.refCount = Math.max(0, entry.refCount - 1);
  if (entry.refCount === 0) {
    const pending = entry.pendingEvict;
    if (pending.length > 0) {
      entry.pendingEvict = [];
      void closeEntry(comicId, entry).then(() => {
        for (const cb of pending) cb();
      });
    }
  }
}

export async function evict(comicId: string): Promise<void> {
  const entry = store.get(comicId);
  if (!entry) return;
  if (entry.refCount === 0) {
    await closeEntry(comicId, entry);
    return;
  }
  await new Promise<void>((resolve) => {
    entry.pendingEvict.push(resolve);
  });
}

export async function closeAll(): Promise<void> {
  const entries = [...store.entries()];
  await Promise.all(entries.map(([id, entry]) => closeEntry(id, entry)));
}

async function openComicArchive(comicId: string): Promise<OpenedArchive> {
  const comic = await prisma.comic.findUnique({
    where: { id: comicId },
    select: { filePath: true },
  });
  if (!comic) {
    throw new Response("Not found", { status: 404 });
  }
  const absPath = resolveLibraryPath(comic.filePath);
  return openFromPath(absPath);
}

async function closeEntry(id: string, entry: Entry): Promise<void> {
  store.delete(id);
  try {
    await entry.archive.close();
  } catch (err) {
    console.error(`[archive-cache] close failed for ${id}`, err);
  }
}

function evictIfNeeded(): void {
  if (store.size <= CAPACITY) return;
  let lruId: string | null = null;
  let lruStamp = Infinity;
  for (const [id, entry] of store) {
    if (entry.refCount !== 0) continue;
    if (entry.lastUsed < lruStamp) {
      lruStamp = entry.lastUsed;
      lruId = id;
    }
  }
  if (!lruId) return;
  const entry = store.get(lruId);
  if (!entry) return;
  void closeEntry(lruId, entry);
}

import { disconnectPrisma } from "#app/lib/db.server";

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[panels] received ${signal}; shutting down`);

  // Order matters: close archives first (they read from the DB on
  // open but not on close), then disconnect Prisma.
  try {
    await Promise.race([
      closeAll(),
      new Promise<void>((resolve) => setTimeout(resolve, 5000)),
    ]);
  } catch (err) {
    console.error("[panels] archive shutdown failed", err);
  }
  await disconnectPrisma();
  process.exit(0);
}

if (env.NODE_ENV === "production") {
  process.once("SIGTERM", () => {
    void shutdown("SIGTERM");
  });
  process.once("SIGINT", () => {
    void shutdown("SIGINT");
  });
}