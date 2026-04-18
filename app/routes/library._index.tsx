import { Form, Link, redirect, useSearchParams } from "react-router";
import { Badge } from "#app/components/ui/badge";
import { Button } from "#app/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "#app/components/ui/card";
import { requireUser } from "#app/lib/auth-utils.server";
import { prisma } from "#app/lib/db.server";
import { thumbUrl } from "#app/lib/thumbnails";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function meta() {
  return [{ title: "Library — panels" }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const user = await requireUser(request);

  const count = await prisma.comic.count();
  if (count === 0) throw redirect("/onboarding");

  const comics = await prisma.comic.findMany({
    orderBy: [
      { series: "asc" },
      { volume: "asc" },
      { issueNumber: "asc" },
      { title: "asc" },
    ],
    include: {
      progress: { where: { userId: user.id } },
    },
  });

  return { user, comics };
}

export default function Library({ loaderData }: Route.ComponentProps) {
  const { user, comics } = loaderData;
  const [searchParams] = useSearchParams();

  const scanned = searchParams.get("scanned");
  const added = searchParams.get("added");
  const skipped = searchParams.get("skipped");
  const failed = searchParams.get("failed");

  return (
    <div className="container mx-auto flex min-h-screen flex-col gap-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Library</h1>
          <p className="text-sm text-muted-foreground">
            {comics.length} {comics.length === 1 ? "comic" : "comics"} ·
            Signed in as {user.name}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link to="/upload">Upload</Link>
          </Button>
          <Form method="post" action="/library/scan">
            <Button type="submit" variant="secondary">
              Scan
            </Button>
          </Form>
          <Button asChild variant="ghost">
            <Link to="/settings/invites">Invites</Link>
          </Button>
          <Form method="post" action="/logout">
            <Button type="submit" variant="ghost">
              Sign out
            </Button>
          </Form>
        </div>
      </header>

      {scanned ? (
        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          Scanned {scanned} file(s): {added} added, {skipped} skipped, {failed}{" "}
          failed.
        </div>
      ) : null}

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {comics.map((comic) => {
          const progress = comic.progress[0];
          const pct = progress
            ? Math.round(
                ((progress.currentPageIndex + 1) / comic.pageCount) * 100,
              )
            : 0;
          return (
            <li key={comic.id}>
              <Link
                to={`/comics/${comic.id}`}
                className="group block"
                aria-label={comic.title}
              >
                <div className="aspect-[2/3] w-full overflow-hidden rounded-md border bg-muted">
                  <img
                    src={thumbUrl(comic.id, comic.coverPage, "card")}
                    alt={`Cover of ${comic.title}`}
                    className="h-full w-full object-cover transition-opacity"
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    onError={(event) => {
                      const target = event.currentTarget;
                      target.style.display = "none";
                      target.insertAdjacentHTML(
                        "afterend",
                        `<div class="flex h-full w-full items-center justify-center p-2 text-center text-xs text-muted-foreground"><span class="line-clamp-4">${escapeHtml(comic.title)}</span></div>`,
                      );
                    }}
                  />
                </div>
                <div className="mt-2 flex flex-col gap-0.5">
                  <span className="line-clamp-2 text-sm font-medium group-hover:underline">
                    {comic.title}
                  </span>
                  <div className="flex items-center gap-1">
                    {comic.series ? (
                      <span className="truncate text-xs text-muted-foreground">
                        {comic.series}
                        {comic.issueNumber ? ` #${comic.issueNumber}` : ""}
                      </span>
                    ) : null}
                    {comic.isManga ? (
                      <Badge variant="secondary" className="text-[10px]">
                        RTL
                      </Badge>
                    ) : null}
                  </div>
                  {progress ? (
                    <div className="h-1 w-full rounded-full bg-muted">
                      <div
                        className="h-1 rounded-full bg-primary"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  ) : null}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}