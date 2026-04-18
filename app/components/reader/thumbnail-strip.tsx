import { useEffect, useMemo, useRef } from "react";
import { Button } from "#app/components/ui/button";
import { cn } from "#app/lib/misc";
import { thumbUrl } from "#app/lib/thumbnails";

const VISIBLE_WINDOW = 24;

export function ThumbnailStrip({
  comicId,
  totalPages,
  currentPage,
  onSelect,
  className,
}: {
  comicId: string;
  totalPages: number;
  currentPage: number;
  onSelect: (index: number) => void;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const currentRef = useRef<HTMLButtonElement | null>(null);

  const THUMB_WIDTH = 72;
  const THUMB_GAP = 8;
  const ITEM_WIDTH = THUMB_WIDTH + THUMB_GAP;

  const { start, end } = useMemo(() => {
    const half = Math.floor(VISIBLE_WINDOW / 2);
    let s = Math.max(0, currentPage - half);
    let e = Math.min(totalPages, s + VISIBLE_WINDOW);
    s = Math.max(0, e - VISIBLE_WINDOW);
    return { start: s, end: e };
  }, [currentPage, totalPages]);

  useEffect(() => {
    const el = currentRef.current;
    if (!el) return;
    el.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [currentPage]);

  const renderedPages: number[] = [];
  for (let i = start; i < end; i++) renderedPages.push(i);

  const leftSpacer = start * ITEM_WIDTH;
  const rightSpacer = (totalPages - end) * ITEM_WIDTH;

  return (
    <div
      ref={scrollRef}
      className={cn(
        "flex items-center gap-2 overflow-x-auto overflow-y-hidden scroll-smooth px-3 py-2",
        className,
      )}
      role="listbox"
      aria-label="Pages"
    >
      {leftSpacer > 0 ? (
        <div
          aria-hidden
          className="flex-none"
          style={{ width: leftSpacer, height: 1 }}
        />
      ) : null}

      {renderedPages.map((pageIndex) => {
        const isCurrent = pageIndex === currentPage;
        return (
          <button
            key={pageIndex}
            ref={isCurrent ? currentRef : undefined}
            type="button"
            onClick={() => onSelect(pageIndex)}
            className={cn(
              "relative flex-none overflow-hidden rounded border bg-black/40 transition",
              isCurrent
                ? "border-white ring-2 ring-white/60"
                : "border-white/20 opacity-60 hover:opacity-100",
            )}
            style={{ width: THUMB_WIDTH, height: THUMB_WIDTH * 1.5 }}
            aria-label={`Page ${pageIndex + 1}`}
            aria-selected={isCurrent}
            role="option"
          >
            <img
              src={thumbUrl(comicId, pageIndex, "strip")}
              alt=""
              className="h-full w-full object-cover"
              loading="eager"
              decoding="async"
              draggable={false}
            />
            <span className="pointer-events-none absolute bottom-0 right-0 rounded-tl bg-black/70 px-1 text-[10px] text-white/90">
              {pageIndex + 1}
            </span>
          </button>
        );
      })}

      {rightSpacer > 0 ? (
        <div
          aria-hidden
          className="flex-none"
          style={{ width: rightSpacer, height: 1 }}
        />
      ) : null}
    </div>
  );
}

export function ThumbnailToggle({
  open,
  onToggle,
}: {
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <Button
      size="sm"
      variant="ghost"
      className="text-white hover:bg-white/10 hover:text-white"
      onClick={onToggle}
      aria-pressed={open}
    >
      {open ? "Hide pages" : "Pages"}
    </Button>
  );
}