import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "#app/generated/prisma/client";
import { env } from "#app/lib/env.server";

function createPrisma(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url: env.DATABASE_URL });
  const client = new PrismaClient({ adapter });

  void client.$executeRawUnsafe("PRAGMA journal_mode = WAL;").catch(() => {});
  void client.$executeRawUnsafe("PRAGMA synchronous = NORMAL;").catch(() => {});
  void client.$executeRawUnsafe("PRAGMA foreign_keys = ON;").catch(() => {});
  void client.$executeRawUnsafe("PRAGMA busy_timeout = 5000;").catch(() => {});
  void client.$executeRawUnsafe("PRAGMA temp_store = MEMORY;").catch(() => {});
  void client.$executeRawUnsafe("PRAGMA cache_size = -64000;").catch(() => {});

  return client;
}

declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma: PrismaClient = globalThis.__prisma ?? createPrisma();
if (env.NODE_ENV !== "production") globalThis.__prisma = prisma;

if (env.NODE_ENV === "production") {
  process.once("SIGTERM", () => {
    void prisma.$disconnect().finally(() => process.exit(0));
  });
}