import { useCallback, useEffect, useState } from "react";
import {
  Link,
  redirect,
  useNavigate,
  useSearchParams,
} from "react-router";
import { JumpToPageDialog } from "#app/components/reader/jump-to-page";
import { useReaderKeyboard } from "#app/components/reader/keyboard";
import { PageImage } from "#app/components/reader/page-image";
import { usePagePrefetch } from "#app/components/reader/prefetch";
import { useSaveProgress } from "#app/components/reader/progress";
import { Button } from "#app/components/ui/button";
import { requireUser } from "#app/lib/auth-utils.server";
import { prisma } from "#app/lib/db.server";
import type { Route } from "./+types/comics.$comicId.read";

export function meta({ data }: Route.MetaArgs) {
  if (!data?.comic) return [{ title: "Reader — panels" }];
  return [{ title: `${data.comic.title} — panels` }];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const comic = await prisma.comic.findUnique({
    where: { id: params.comicId },
    include: {
      progress: { where: { userId: user.id } },
    },
  });
  if (!comic) throw new Response("Not found", { status: 404 });
  if (comic.pageCount <= 0) {
    throw redirect(`/comics/${comic.id}`);
  }

  const url = new URL(request.url);
  const pageParam = url.searchParams.get("page");
  const savedIndex = comic.progress[0]?.currentPageIndex ?? 0;

  let initialIndex = savedIndex;
  if (pageParam !== null) {
    const n = Number(pageParam);
    if (Number.isFinite(n) && Number.isInteger(n) && n >= 0) {
      initialIndex = Math.min(n, comic.pageCount - 1);
    }
  }

  return {
    comic: {
      id: comic.id,
      title: comic.title,
      pageCount: comic.pageCount,
      isManga: comic.isManga,
      coverPage: comic.coverPage,
    },
    initialIndex,
  };
}

export default function Reader({ loaderData }: Route.ComponentProps) {
  const { comic, initialIndex } = loaderData;
  const [pageIndex, setPageIndex] = useState(initialIndex);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const current = searchParams.get("page");
    if (current !== String(pageIndex)) {
      const next = new URLSearchParams(searchParams);
      next.set("page", String(pageIndex));
      setSearchParams(next, { replace: true });
    }
  }, [pageIndex, searchParams, setSearchParams]);

  usePagePrefetch(comic.id, pageIndex, comic.pageCount);
  useSaveProgress(comic.id, pageIndex);

  const gotoNext = useCallback(() => {
    setPageIndex((p) => Math.min(p + 1, comic.pageCount - 1));
  }, [comic.pageCount]);
  const gotoPrev = useCallback(() => {
    setPageIndex((p) => Math.max(p - 1, 0));
  }, []);
  const gotoFirst = useCallback(() => setPageIndex(0), []);
  const gotoLast = useCallback(() => {
    setPageIndex(comic.pageCount - 1);
  }, [comic.pageCount]);
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
    } else {
      void document.documentElement.requestFullscreen();
    }
  }, []);
  const openJump = useCallback(() => setJumpOpen(true), []);
  const exit = useCallback(() => {
    navigate(`/comics/${comic.id}`);
  }, [comic.id, navigate]);

  useReaderKeyboard({
    onNext: gotoNext,
    onPrev: gotoPrev,
    onFirst: gotoFirst,
    onLast: gotoLast,
    onToggleFullscreen: toggleFullscreen,
    onJumpTo: openJump,
    onExit: exit,
  });

  function onPageClick(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const third = rect.width / 3;
    if (x < third) gotoPrev();
    else if (x > 2 * third) gotoNext();
  }

  const atStart = pageIndex === 0;
  const atEnd = pageIndex === comic.pageCount - 1;

  return (
    <div className="flex h-[100dvh] flex-col bg-black text-white">
      <header className="flex items-center justify-between gap-2 border-b border-white/10 bg-black/80 px-3 py-2 text-sm">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            asChild
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/10 hover:text-white"
          >
            <Link to={`/comics/${comic.id}`}>← Back</Link>
          </Button>
          <span className="truncate font-medium">{comic.title}</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-white/70">
          <span>
            Page {pageIndex + 1} / {comic.pageCount}
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/10 hover:text-white"
            onClick={openJump}
          >
            Jump
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/10 hover:text-white"
            onClick={toggleFullscreen}
          >
            Fullscreen
          </Button>
        </div>
      </header>

      <div
        className="relative flex-1 cursor-pointer select-none overflow-hidden"
        onClick={onPageClick}
        role="button"
        tabIndex={-1}
      >
        <PageImage
          comicId={comic.id}
          pageIndex={pageIndex}
          totalPages={comic.pageCount}
          className="h-full w-full"
        />
      </div>

      <footer className="flex items-center justify-between gap-2 border-t border-white/10 bg-black/80 px-3 py-2">
        <Button
          variant="ghost"
          className="text-white hover:bg-white/10 hover:text-white"
          disabled={atStart}
          onClick={gotoPrev}
        >
          ← Previous
        </Button>
        <div className="flex-1">
          <input
            type="range"
            min={0}
            max={Math.max(0, comic.pageCount - 1)}
            value={pageIndex}
            onChange={(event) => setPageIndex(Number(event.target.value))}
            className="w-full accent-white"
            aria-label="Page scrubber"
          />
        </div>
        <Button
          variant="ghost"
          className="text-white hover:bg-white/10 hover:text-white"
          disabled={atEnd}
          onClick={gotoNext}
        >
          Next →
        </Button>
      </footer>

      <JumpToPageDialog
        open={jumpOpen}
        onOpenChange={setJumpOpen}
        currentPage={pageIndex}
        totalPages={comic.pageCount}
        onJump={(index) => setPageIndex(index)}
      />
    </div>
  );
}