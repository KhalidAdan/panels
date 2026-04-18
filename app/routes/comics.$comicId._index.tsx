import { Button } from "#app/components/ui/button";
import { evict } from "#app/lib/archive-cache.server";
import { requireUser } from "#app/lib/auth-utils.server";
import { prisma } from "#app/lib/db.server";
import { env } from "#app/lib/env.server";
import { thumbUrl } from "#app/lib/thumbnails";
import { removeAllThumbs } from "#app/lib/thumbnails.server";
import { resolveLibraryPath } from "#app/lib/validate-cbz.server";
import fs from "node:fs/promises";
import path from "node:path";
import { Form, Link, data, redirect, useSearchParams } from "react-router";
import type { Route } from "./+types/comics.$comicId._index";

export function meta({ data }: Route.MetaArgs) {
  return [
    {
      title: data?.comic?.title
        ? `${data.comic.title} — panels`
        : "Comic — panels",
    },
  ];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const comic = await prisma.comic.findUnique({
    where: { id: params.comicId },
    include: {
      progress: { where: { userId: user.id } },
      importedBy: { select: { id: true, name: true } },
    },
  });
  if (!comic) {
    throw new Response("Comic not found", { status: 404 });
  }
  return { user, comic };
}

export async function action({ params, request }: Route.ActionArgs) {
  const user = await requireUser(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "delete") {
    const comic = await prisma.comic.findUnique({
      where: { id: params.comicId },
    });
    if (!comic) throw new Response("Not found", { status: 404 });
    if (comic.importedById !== user.id) {
      throw new Response("Forbidden", { status: 403 });
    }

    await evict(comic.id);

    await prisma.comic.delete({ where: { id: comic.id } });

    await removeAllThumbs(comic.id);

    try {
      const abs = resolveLibraryPath(comic.filePath);
      if (abs.startsWith(path.resolve(env.LIBRARY_PATH))) {
        await fs.rm(abs, { force: true });
      }
    } catch (err) {
      console.error("[comics.delete] file cleanup failed", err);
    }

    return redirect("/library");
  }

  return data({ error: "Unknown intent" }, { status: 400 });
}

export default function ComicDetail({ loaderData }: Route.ComponentProps) {
  const { user, comic } = loaderData;
  const [searchParams] = useSearchParams();
  const isDup = searchParams.get("dup") === "1";
  const wasSaved = searchParams.get("saved") === "1";

  const progress = comic.progress[0];
  const canDelete = comic.importedById === user.id;

  return (
    <div className="container mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-6">
      <header className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/library">← Library</Link>
        </Button>
      </header>

      {isDup ? (
        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          This comic was already in the library — jumped to the existing entry.
        </div>
      ) : null}

      {wasSaved ? (
        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          Changes saved.
        </div>
      ) : null}

      <div className="flex flex-col gap-6 sm:flex-row">
        <div className="aspect-2/3 w-full max-w-96 flex-none overflow-hidden border bg-muted">
          <img
            src={thumbUrl(comic.id, comic.coverPage, "card")}
            alt={`Cover of ${comic.title}`}
            className="h-full w-full object-cover"
            loading="eager"
            decoding="async"
            draggable={false}
          />
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <h1 className="text-2xl font-semibold">{comic.title}</h1>
            {comic.series ? (
              <p className="text-sm text-muted-foreground">
                {comic.series}
                {comic.issueNumber ? ` #${comic.issueNumber}` : ""}
                {comic.year ? ` · ${comic.year}` : ""}
                {comic.publisher ? ` · ${comic.publisher}` : ""}
              </p>
            ) : null}
          </div>

          {comic.summary ? (
            <div
              className="prose prose-sm prose-p:mb-1 max-w-none"
              dangerouslySetInnerHTML={{ __html: comic.summary }}
            />
          ) : null}

          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Pages</dt>
            <dd>{comic.pageCount}</dd>
            {comic.writer ? (
              <>
                <dt className="text-muted-foreground">Writer</dt>
                <dd>{comic.writer}</dd>
              </>
            ) : null}
            {comic.volume !== null ? (
              <>
                <dt className="text-muted-foreground">Volume</dt>
                <dd>{comic.volume}</dd>
              </>
            ) : null}
            {comic.isManga ? (
              <>
                <dt className="text-muted-foreground">Reading</dt>
                <dd>Right-to-left (manga)</dd>
              </>
            ) : null}
            {progress ? (
              <>
                <dt className="text-muted-foreground">Progress</dt>
                <dd>
                  Page {progress.currentPageIndex + 1} of {comic.pageCount}
                </dd>
              </>
            ) : null}
            {comic.importedBy ? (
              <>
                <dt className="text-muted-foreground">Added by</dt>
                <dd>{comic.importedBy.name}</dd>
              </>
            ) : null}
          </dl>

          <div className="mt-2 flex flex-wrap gap-2">
            <Button asChild>
              <Link to={`/comics/${comic.id}/read`}>Read</Link>
            </Button>
            {canDelete ? (
              <Button asChild variant="secondary">
                <Link to={`/comics/${comic.id}/edit`}>Edit</Link>
              </Button>
            ) : null}
            {canDelete ? (
              <Form method="post">
                <input type="hidden" name="intent" value="delete" />
                <Button
                  type="submit"
                  variant="destructive"
                  onClick={(event) => {
                    if (
                      !window.confirm(
                        `Delete "${comic.title}" and its file? This can't be undone.`,
                      )
                    ) {
                      event.preventDefault();
                    }
                  }}
                >
                  Delete
                </Button>
              </Form>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
