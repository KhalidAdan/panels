import { ContinuousReader } from "#app/components/reader/continuous/continuous-reader";
import {
  computeSpreads,
  findSpreadIndex,
  spreadLeadPage,
  type SpreadUnit,
} from "#app/components/reader/double-page";
import { HelpDialog } from "#app/components/reader/help-dialog";
import { JumpToPageDialog } from "#app/components/reader/jump-to-page";
import { useReaderKeyboard } from "#app/components/reader/keyboard";
import { PageImage } from "#app/components/reader/page-image";
import { usePagePrefetch } from "#app/components/reader/prefetch";
import { useSaveProgress } from "#app/components/reader/progress";
import { switchReaderMode } from "#app/components/reader/switch-mode";
import {
  ThumbnailStrip,
  ThumbnailToggle,
} from "#app/components/reader/thumbnail-strip";
import { Button } from "#app/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#app/components/ui/dropdown-menu";
import { requireUser } from "#app/lib/auth-utils.server";
import { prisma } from "#app/lib/db.server";
import { cn } from "#app/lib/misc";
import {
  resolveRTL,
  type BackgroundColor,
  type FitMode,
  type ReaderMode,
  type ReaderPrefs,
} from "#app/lib/reader-prefs";
import { readPrefs as readPrefsServer } from "#app/lib/reader-prefs.server";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Link,
  redirect,
  useFetcher,
  useNavigate,
  useSearchParams,
} from "react-router";
import type { Route } from "./+types/comics.$comicId.read";

export function meta() {
  return [{ title: "Reader — panels" }];
}

export async function loader({ params, request }: Route.LoaderArgs) {
  const user = await requireUser(request);
  const comic = await prisma.comic.findUnique({
    where: { id: params.comicId },
    include: {
      progress: { where: { userId: user.id } },
      pages: { orderBy: { pageIndex: "asc" } },
    },
  });
  if (!comic) throw new Response("Not found", { status: 404 });
  if (comic.pageCount <= 0) {
    throw redirect(`/comics/${comic.id}`);
  }

  const prefs = readPrefsServer(request);
  const rtl = resolveRTL(prefs, comic.isManga);

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

  const isWide: boolean[] = Array.from(
    { length: comic.pageCount },
    () => false,
  );
  for (const p of comic.pages) {
    if (p.pageIndex >= 0 && p.pageIndex < comic.pageCount) {
      isWide[p.pageIndex] = p.isWide;
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
    prefs,
    rtl,
    isWide,
  };
}

const BG_CLASSES: Record<BackgroundColor, string> = {
  black: "bg-black text-white",
  gray: "bg-neutral-600 text-white",
  white: "bg-white text-black",
};

const BG_ORDER: BackgroundColor[] = ["black", "gray", "white"];

const FIT_CLASSES: Record<FitMode, string> = {
  screen: "max-h-full max-w-full object-contain",
  width: "w-full h-auto object-contain",
  height: "h-full w-auto object-contain",
};

export default function Reader({ loaderData }: Route.ComponentProps) {
  const { comic, initialIndex, prefs, isWide } = loaderData;

  if (prefs.readerMode === "continuous") {
    return (
      <ContinuousReader
        comic={{
          id: comic.id,
          title: comic.title,
          pageCount: comic.pageCount,
          isManga: comic.isManga,
        }}
        initialIndex={initialIndex}
        prefs={prefs}
        isWide={isWide}
      />
    );
  }

  return (
    <PaginatedReader
      comic={comic}
      initialIndex={initialIndex}
      prefs={prefs}
      isWide={isWide}
    />
  );
}

function PaginatedReader({
  comic,
  initialIndex,
  prefs,
  isWide,
}: {
  comic: {
    id: string;
    title: string;
    pageCount: number;
    isManga: boolean;
    coverPage: number;
  };
  initialIndex: number;
  prefs: {
    readerMode: ReaderMode;
    fit: FitMode;
    doublePage: boolean;
    background: BackgroundColor;
    rtlOverride: "auto" | "ltr" | "rtl";
    continuousFit: "width" | "original";
    thumbSidebarOpen: boolean;
  };
  isWide: boolean[];
}) {
  const paginatedPrefs: ReaderPrefs = {
    readerMode: prefs.readerMode,
    fit: prefs.fit as FitMode,
    doublePage: prefs.doublePage,
    background: prefs.background as BackgroundColor,
    rtlOverride: prefs.rtlOverride,
    continuousFit: prefs.continuousFit,
    thumbSidebarOpen: prefs.thumbSidebarOpen,
  };
  const initialRtl = resolveRTL(paginatedPrefs, comic.isManga);
  const [pageIndex, setPageIndex] = useState(initialIndex);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [stripOpen, setStripOpen] = useState(false);

  const [fit, setFit] = useState<FitMode>(prefs.fit as FitMode);
  const [doublePage, setDoublePage] = useState(prefs.doublePage);
  const [background, setBackground] = useState<BackgroundColor>(
    prefs.background as BackgroundColor,
  );
  const [rtl, setRtl] = useState(initialRtl);

  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const prefsFetcher = useFetcher();

  const savePrefs = useCallback(
    (patch: Record<string, string | boolean>) => {
      prefsFetcher.submit(
        Object.fromEntries(
          Object.entries(patch).map(([k, v]) => [k, String(v)]),
        ),
        { method: "post", action: "/resources/prefs" },
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const spreads = useMemo<SpreadUnit[]>(
    () => (doublePage ? computeSpreads(isWide) : []),
    [doublePage, isWide],
  );
  const currentSpreadIndex = doublePage
    ? findSpreadIndex(spreads, pageIndex)
    : pageIndex;
  const currentSpread = doublePage ? spreads[currentSpreadIndex] : null;

  useEffect(() => {
    const current = searchParams.get("page");
    if (current !== String(pageIndex)) {
      const next = new URLSearchParams(searchParams);
      next.set("page", String(pageIndex));
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageIndex]);

  usePagePrefetch(comic.id, pageIndex, comic.pageCount);
  useSaveProgress(comic.id, pageIndex);

  const gotoNext = useCallback(() => {
    if (doublePage && spreads.length > 0) {
      setPageIndex((p) => {
        const here = findSpreadIndex(spreads, p);
        const next = Math.min(here + 1, spreads.length - 1);
        return spreadLeadPage(spreads[next]!);
      });
    } else {
      setPageIndex((p) => Math.min(p + 1, comic.pageCount - 1));
    }
  }, [comic.pageCount, doublePage, spreads]);

  const gotoPrev = useCallback(() => {
    if (doublePage && spreads.length > 0) {
      setPageIndex((p) => {
        const here = findSpreadIndex(spreads, p);
        const next = Math.max(here - 1, 0);
        return spreadLeadPage(spreads[next]!);
      });
    } else {
      setPageIndex((p) => Math.max(p - 1, 0));
    }
  }, [doublePage, spreads]);

  const gotoFirst = useCallback(() => setPageIndex(0), []);
  const gotoLast = useCallback(() => {
    setPageIndex(comic.pageCount - 1);
  }, [comic.pageCount]);
  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  }, []);
  const openJump = useCallback(() => setJumpOpen(true), []);
  const exit = useCallback(() => {
    navigate(`/comics/${comic.id}`);
  }, [comic.id, navigate]);

  useReaderKeyboard(
    {
      onNext: gotoNext,
      onPrev: gotoPrev,
      onFirst: gotoFirst,
      onLast: gotoLast,
      onToggleFullscreen: toggleFullscreen,
      onJumpTo: openJump,
      onExit: exit,
    },
    rtl,
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }

      switch (event.key) {
        case "t":
        case "T":
          setStripOpen((v) => !v);
          event.preventDefault();
          break;
        case "?":
          setHelpOpen((v) => !v);
          event.preventDefault();
          break;
        case "d":
        case "D":
          setDoublePage((v) => {
            const next = !v;
            savePrefs({ doublePage: next });
            return next;
          });
          event.preventDefault();
          break;
        case "1":
          setFit("screen");
          savePrefs({ fit: "screen" });
          event.preventDefault();
          break;
        case "2":
          setFit("width");
          savePrefs({ fit: "width" });
          event.preventDefault();
          break;
        case "3":
          setFit("height");
          savePrefs({ fit: "height" });
          event.preventDefault();
          break;
        case "b":
        case "B":
          setBackground((current) => {
            const idx = BG_ORDER.indexOf(current);
            const next = BG_ORDER[(idx + 1) % BG_ORDER.length]!;
            savePrefs({ background: next });
            return next;
          });
          event.preventDefault();
          break;
        case "r":
        case "R":
          setRtl((currentRtl) => {
            const next = !currentRtl;
            savePrefs({ rtlOverride: next ? "rtl" : "ltr" });
            return next;
          });
          event.preventDefault();
          break;
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [savePrefs]);

  function onPageClick(event: React.MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const third = rect.width / 3;
    if (x < third) {
      if (rtl) gotoNext();
      else gotoPrev();
    } else if (x > 2 * third) {
      if (rtl) gotoPrev();
      else gotoNext();
    }
  }

  const atStart = pageIndex === 0;
  const atEnd = pageIndex === comic.pageCount - 1;

  const changeFit = (value: FitMode) => {
    setFit(value);
    savePrefs({ fit: value });
  };
  const changeBackground = (value: BackgroundColor) => {
    setBackground(value);
    savePrefs({ background: value });
  };
  const toggleDoublePage = () => {
    setDoublePage((v) => {
      const next = !v;
      savePrefs({ doublePage: next });
      return next;
    });
  };

  return (
    <div className={cn("flex h-[100dvh] flex-col", BG_CLASSES[background])}>
      <header className="flex items-center justify-between gap-2 border-b border-white/10 bg-black/80 px-3 py-2 text-sm text-white">
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
        <div className="flex items-center gap-1 text-xs text-white/70">
          <span className="mr-2">
            Page {pageIndex + 1} / {comic.pageCount}
            {rtl ? " · RTL" : ""}
            {doublePage ? " · 2P" : ""}
          </span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="ghost"
                className="text-white hover:bg-white/10 hover:text-white"
              >
                View
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Reader mode</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={prefs.readerMode}
                onValueChange={(value) => {
                  if (value === "continuous") {
                    void switchReaderMode("continuous");
                  }
                }}
              >
                <DropdownMenuRadioItem value="paginated">
                  Paginated
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="continuous">
                  Continuous scroll
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Fit</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={fit}
                onValueChange={(value) => changeFit(value as FitMode)}
              >
                <DropdownMenuRadioItem value="screen">
                  Fit to screen (1)
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="width">
                  Fit to width (2)
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="height">
                  Fit to height (3)
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Background</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={background}
                onValueChange={(value) =>
                  changeBackground(value as BackgroundColor)
                }
              >
                <DropdownMenuRadioItem value="black">
                  Black
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="gray">Gray</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="white">
                  White
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem
                checked={doublePage}
                onCheckedChange={toggleDoublePage}
              >
                Double-page (D)
              </DropdownMenuCheckboxItem>
              <DropdownMenuCheckboxItem
                checked={rtl}
                onCheckedChange={() => {
                  const next = !rtl;
                  setRtl(next);
                  savePrefs({ rtlOverride: next ? "rtl" : "ltr" });
                }}
              >
                Right-to-left (R)
              </DropdownMenuCheckboxItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <ThumbnailToggle
            open={stripOpen}
            onToggle={() => setStripOpen((v) => !v)}
          />
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
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/10 hover:text-white"
            onClick={() => setHelpOpen(true)}
          >
            ?
          </Button>
        </div>
      </header>

      <div
        className="relative flex-1 cursor-pointer select-none overflow-hidden"
        onClick={onPageClick}
        role="button"
        tabIndex={-1}
      >
        {doublePage && currentSpread?.kind === "pair" ? (
          <div
            className={cn(
              "flex h-full w-full items-center justify-center",
              rtl ? "flex-row-reverse" : "flex-row",
            )}
          >
            <SpreadHalf
              comicId={comic.id}
              pageIndex={currentSpread.left}
              totalPages={comic.pageCount}
              fit={fit}
            />
            <SpreadHalf
              comicId={comic.id}
              pageIndex={currentSpread.right}
              totalPages={comic.pageCount}
              fit={fit}
            />
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <PageImage
              comicId={comic.id}
              pageIndex={pageIndex}
              totalPages={comic.pageCount}
              imgClassName={FIT_CLASSES[fit]}
            />
          </div>
        )}
      </div>

      <footer className="flex flex-col border-t border-white/10 bg-black/80 text-white">
        {stripOpen ? (
          <ThumbnailStrip
            comicId={comic.id}
            totalPages={comic.pageCount}
            currentPage={pageIndex}
            onSelect={(index) => setPageIndex(index)}
            className="border-b border-white/10"
          />
        ) : null}
        <div
          className={cn(
            "flex items-center justify-between gap-2 px-3 py-2",
            rtl ? "flex-row-reverse" : "flex-row",
          )}
        >
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
              className={cn("w-full accent-white", rtl && "rotate-180")}
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
        </div>
      </footer>

      <JumpToPageDialog
        open={jumpOpen}
        onOpenChange={setJumpOpen}
        currentPage={pageIndex}
        totalPages={comic.pageCount}
        onJump={(index) => setPageIndex(index)}
      />
      <HelpDialog open={helpOpen} onOpenChange={setHelpOpen} isRTL={rtl} />
    </div>
  );
}

function SpreadHalf({
  comicId,
  pageIndex,
  totalPages,
  fit,
}: {
  comicId: string;
  pageIndex: number;
  totalPages: number;
  fit: FitMode;
}) {
  const fitClass =
    fit === "screen"
      ? "max-h-full max-w-full object-contain"
      : fit === "width"
        ? "w-full h-auto object-contain"
        : "h-full w-auto object-contain";
  return (
    <div className="flex h-full w-1/2 items-center justify-center">
      <PageImage
        comicId={comicId}
        pageIndex={pageIndex}
        totalPages={totalPages}
        imgClassName={fitClass}
      />
    </div>
  );
}
