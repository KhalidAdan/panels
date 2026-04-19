import { Button } from "#app/components/ui/button";
import { cn } from "#app/lib/misc";
import { useEffect, useMemo, useRef } from "react";
import { ThumbnailButton } from "./thumbnail-button";

const VISIBLE_WINDOW = 50;
const ITEM_HEIGHT = 158;

export function VerticalThumbs({
  comicId,
  totalPages,
  currentPage,
  onSelect,
  side,
  onDismiss,
}: {
  comicId: string;
  totalPages: number;
  currentPage: number;
  onSelect: (index: number) => void;
  side: "left" | "right";
  onDismiss: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const currentRef = useRef<HTMLButtonElement | null>(null);

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
      block: "center",
    });
  }, [currentPage]);

  const renderedPages: number[] = [];
  for (let i = start; i < end; i++) renderedPages.push(i);

  const topSpacer = start * ITEM_HEIGHT;
  const bottomSpacer = (totalPages - end) * ITEM_HEIGHT;

  return (
    <aside
      ref={scrollRef}
      className={cn(
        "fixed inset-y-0 overflow-y-auto bg-black/90 border-white/10",
        side === "left" ? "left-0 border-r" : "right-0 border-l",
      )}
    >
      <div className="sticky top-0 z-10 border-b border-white/10 bg-black/90 p-2">
        <Button
          size="sm"
          variant="ghost"
          className="w-full text-white hover:bg-white/10"
          onClick={onDismiss}
        >
          ✕
        </Button>
      </div>

      {topSpacer > 0 ? <div aria-hidden style={{ height: topSpacer }} /> : null}

      {renderedPages.map((pageIndex) => {
        const isCurrent = pageIndex === currentPage;
        return (
          <ThumbnailButton
            id={comicId}
            index={pageIndex}
            isCurrent={isCurrent}
            ref={currentRef}
            on={onSelect}
          />
        );
      })}

      {bottomSpacer > 0 ? (
        <div aria-hidden style={{ height: bottomSpacer }} />
      ) : null}
    </aside>
  );
}
