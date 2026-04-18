import { z } from "zod";
import { requireUser } from "#app/lib/auth-utils.server";
import { prisma } from "#app/lib/db.server";
import type { Route } from "./+types/resources.progress";

const Schema = z.object({
  comicId: z.string().min(1),
  pageIndex: z.coerce.number().int().min(0),
});

export async function loader() {
  return new Response("Method not allowed", { status: 405 });
}

export async function action({ request }: Route.ActionArgs) {
  const user = await requireUser(request);

  let body: { comicId?: string; pageIndex?: string | number } = {};
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    body = (await request.json()) as typeof body;
  } else {
    const fd = await request.formData();
    body = {
      comicId: (fd.get("comicId") as string) ?? undefined,
      pageIndex: (fd.get("pageIndex") as string) ?? undefined,
    };
  }

  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return new Response("Bad request", { status: 400 });
  }

  const comic = await prisma.comic.findUnique({
    where: { id: parsed.data.comicId },
    select: { id: true, pageCount: true },
  });
  if (!comic) return new Response("Not found", { status: 404 });

  const clamped = Math.min(
    Math.max(0, parsed.data.pageIndex),
    comic.pageCount - 1,
  );

  await prisma.readingProgress.upsert({
    where: {
      userId_comicId: { userId: user.id, comicId: comic.id },
    },
    create: {
      userId: user.id,
      comicId: comic.id,
      currentPageIndex: clamped,
    },
    update: { currentPageIndex: clamped },
  });

  return new Response(null, { status: 204 });
}