import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Link, useFetcher, useNavigate, useSearchParams } from "react-router";
import { HelpDialog } from "#app/components/reader/help-dialog";
import { JumpToPageDialog } from "#app/components/reader/jump-to-page";
import { PageImage } from "#app/components/reader/page-image";
import { useSaveProgress } from "#app/components/reader/progress";
import { Button } from "#app/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "#app/components/ui/dropdown-menu";
import { cn } from "#app/lib/misc";
import {
  type BackgroundColor,
  type ContinuousFitMode,
  type ReaderPrefs,
} from "#app/lib/reader-prefs";
import { scrollToPageIndex } from "./use-cursor-observer";
import { VerticalThumbs } from "./vertical-thumbs";
import { switchReaderMode } from "#app/components/reader/switch-mode";

const BG_CLASSES: Record<BackgroundColor, string> = {
  black: "bg-black text-white",
  gray: "bg-neutral-600 text-white",
  white: "bg-white text-black",
};

const BG_ORDER: BackgroundColor[] = ["black", "gray", "white"];

interface ContinuousReaderProps {
  comic: {
    id: string;
    title: string;
    pageCount: number;
    isManga: boolean;
  };
  initialIndex: number;
  prefs: ReaderPrefs;
  isWide: boolean[];
}

export function ContinuousReader({
  comic,
  initialIndex,
  prefs,
  isWide,
}: ContinuousReaderProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [fit, setFit] = useState<ContinuousFitMode>(prefs.continuousFit);
  const [background, setBackground] = useState<BackgroundColor>(prefs.background);

  const [cursor, setCursor] = useState(initialIndex);

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
    [prefsFetcher],
  );

  const sidebarSide = prefs.rtlOverride === "rtl" ? "left" : "right";
  const initialScrollDone = useRef(false);

  useEffect(() => {
    if (initialScrollDone.current) return;
    if (scrollRef.current && initialIndex > 0) {
      const el = scrollRef.current?.querySelector(`[data-page-index="${initialIndex}"]`);
      if (el) {
        (el as HTMLElement).scrollIntoView({ behavior: "instant", block: "start" });
      }
    }
    initialScrollDone.current = true;
  }, [initialIndex]);

  useEffect(() => {
    const current = searchParams.get("page");
    if (current !== String(cursor)) {
      const next = new URLSearchParams(searchParams);
      next.set("page", String(cursor));
      setSearchParams(next, { replace: true });
    }
  }, [cursor, searchParams, setSearchParams]);

  useSaveProgress(comic.id, cursor);

  const gotoPage = useCallback(
    (index: number) => {
      if (scrollRef.current) {
        scrollToPageIndex(scrollRef.current, index);
      }
      setCursor(index);
    },
    [],
  );

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  }, []);

  const exit = useCallback(() => {
    navigate(`/comics/${comic.id}`);
  }, [comic.id, navigate]);

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
          setSidebarOpen((v) => !v);
          event.preventDefault();
          break;
        case "?":
          setHelpOpen((v) => !v);
          event.preventDefault();
          break;
        case "1":
          setFit("width");
          event.preventDefault();
          break;
        case "2":
          setFit("original");
          event.preventDefault();
          break;
        case "b":
        case "B":
          setBackground((current) => {
            const idx = BG_ORDER.indexOf(current);
            return BG_ORDER[(idx + 1) % BG_ORDER.length]!;
          });
          event.preventDefault();
          break;
        case "r":
        case "R":
          event.preventDefault();
          break;
        case " ":
          if (scrollRef.current) {
            const newPage = event.shiftKey
              ? Math.max(0, cursor - 1)
              : Math.min(comic.pageCount - 1, cursor + 1);
            scrollToPageIndex(scrollRef.current, newPage);
          }
          event.preventDefault();
          break;
        case "PageDown":
          if (scrollRef.current) {
            const newPage = Math.min(comic.pageCount - 1, cursor + 1);
            scrollToPageIndex(scrollRef.current, newPage);
          }
          event.preventDefault();
          break;
        case "PageUp":
          if (scrollRef.current) {
            const newPage = Math.max(0, cursor - 1);
            scrollToPageIndex(scrollRef.current, newPage);
          }
          event.preventDefault();
          break;
        case "Home":
          if (scrollRef.current) {
            scrollRef.current.scrollTo({ top: 0, behavior: "smooth" });
          }
          event.preventDefault();
          break;
        case "End":
          if (scrollRef.current) {
            scrollRef.current.scrollTo({
              top: scrollRef.current.scrollHeight,
              behavior: "smooth",
            });
          }
          event.preventDefault();
          break;
        case "g":
        case "G":
          setJumpOpen(true);
          event.preventDefault();
          break;
        case "f":
        case "F":
          toggleFullscreen();
          event.preventDefault();
          break;
        case "Escape":
          if (sidebarOpen) {
            setSidebarOpen(false);
          } else {
            exit();
          }
          event.preventDefault();
          break;
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    sidebarOpen,
    prefs.rtlOverride,
    cursor,
    comic.pageCount,
    toggleFullscreen,
    exit,
  ]);

  const changeFit = (value: ContinuousFitMode) => {
    setFit(value);
  };
  const changeBackground = (value: BackgroundColor) => {
    setBackground(value);
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
            Page {cursor + 1} / {comic.pageCount}
            {prefs.rtlOverride === "rtl" ? " · RTL" : ""}
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
                value="continuous"
                onValueChange={(value) => {
                  if (value === "paginated") {
                    void switchReaderMode("paginated");
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
                onValueChange={(value) => changeFit(value as ContinuousFitMode)}
              >
                <DropdownMenuRadioItem value="width">
                  Fit to width (1)
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="original">
                  Original size (2)
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Background</DropdownMenuLabel>
              <DropdownMenuRadioGroup
                value={background}
                onValueChange={(value) => changeBackground(value as BackgroundColor)}
              >
                <DropdownMenuRadioItem value="black">Black</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="gray">Gray</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="white">White</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/10 hover:text-white"
            onClick={() => setSidebarOpen((v) => !v)}
          >
            {sidebarOpen ? "Hide pages" : "Pages"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:bg-white/10 hover:text-white"
            onClick={() => setJumpOpen(true)}
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

      <main className="relative flex-1 overflow-hidden">
        {sidebarOpen && (
          <VerticalThumbs
            comicId={comic.id}
            totalPages={comic.pageCount}
            currentPage={cursor}
            onSelect={(index) => gotoPage(index)}
            side={sidebarSide}
            onDismiss={() => {
              setSidebarOpen(false);
setSidebarOpen(false);
            }}
          />
        )}
        <ScrollContainer
          ref={scrollRef}
          comicId={comic.id}
          pageCount={comic.pageCount}
          sidebarOpen={sidebarOpen}
          sidebarSide={sidebarSide}
          onCursorChange={setCursor}
        />
      </main>

      <footer className="flex items-center gap-2 border-t border-white/10 bg-black/80 px-3 py-2 text-white">
        <input
          type="range"
          min={0}
          max={Math.max(0, comic.pageCount - 1)}
          value={cursor}
          onChange={(e) => gotoPage(Number(e.target.value))}
          className="flex-1 accent-white"
        />
        <span className="text-sm text-white/70">
          {cursor + 1} / {comic.pageCount}
        </span>
      </footer>

      <JumpToPageDialog
        open={jumpOpen}
        onOpenChange={setJumpOpen}
        currentPage={cursor}
        totalPages={comic.pageCount}
        onJump={(index) => gotoPage(index)}
      />
      <HelpDialog
        open={helpOpen}
        onOpenChange={setHelpOpen}
        isRTL={prefs.rtlOverride === "rtl"}
      />
    </div>
  );
}

interface PageSlotProps {
  pageIndex: number;
  comicId: string;
  totalPages: number;
}

function PageSlot({
  pageIndex,
  comicId,
  totalPages,
}: PageSlotProps) {
  return (
    <div
      data-page-index={pageIndex}
      className="w-full flex justify-center"
    >
      <PageImage
        comicId={comicId}
        pageIndex={pageIndex}
        totalPages={totalPages}
        imgClassName="max-w-full h-auto"
      />
    </div>
  );
}

interface ScrollContainerProps {
  ref: RefObject<HTMLDivElement | null>;
  comicId: string;
  pageCount: number;
  sidebarOpen: boolean;
  sidebarSide: "left" | "right";
  onCursorChange: (cursor: number) => void;
}

function ScrollContainer({
  ref,
  comicId,
  pageCount,
  sidebarOpen,
  sidebarSide,
  onCursorChange,
}: ScrollContainerProps) {
  const prevCursorRef = useRef(-1);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const idx = Number((e.target as HTMLElement).dataset.pageIndex);
          if (idx >= 0 && idx !== prevCursorRef.current) {
            prevCursorRef.current = idx;
            onCursorChange(idx);
          }
        }
      },
      { root: el, threshold: 0 },
    );

    const slots = el.querySelectorAll<HTMLElement>("[data-page-index]");
    slots.forEach((s) => io.observe(s));

    return () => io.disconnect();
  }, [ref, pageCount, onCursorChange]);

  return (
    <div
      ref={ref}
      className={cn(
        "h-full overflow-y-auto",
        sidebarOpen
          ? sidebarSide === "left"
            ? "ml-28"
            : "mr-28"
          : "",
      )}
    >
      {Array.from({ length: pageCount }, (_, i) => (
        <PageSlot
          key={i}
          pageIndex={i}
          comicId={comicId}
          totalPages={pageCount}
        />
      ))}
    </div>
  );
}