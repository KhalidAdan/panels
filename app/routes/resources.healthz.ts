import { prisma } from "#app/lib/db.server";

export async function loader() {
  try {
    // A real query — if Prisma's adapter is disconnected or the DB
    // file is missing, this throws. Connect-only checks can pass on
    // a disconnected client due to lazy connection strategies.
    await prisma.$queryRaw`SELECT 1`;
    return new Response("ok", {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (err) {
    console.error("[healthz] failed", err);
    return new Response("db error", {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
