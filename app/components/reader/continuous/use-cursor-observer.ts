import {
  useEffect,
  useState,
  type RefObject,
} from "react";

export function useContinuousCursor(
  containerRef: RefObject<HTMLElement | null>,
  pageCount: number,
): number {
  const [cursor, setCursor] = useState(0);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const visible = new Map<number, number>();

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const idx = Number((e.target as HTMLElement).dataset.pageIndex);
          if (e.isIntersecting) {
            visible.set(idx, e.intersectionRatio);
          } else {
            visible.delete(idx);
          }
        }
        let best = -1;
        let bestRatio = 0;
        for (const [idx, r] of visible) {
          if (r > bestRatio || (r === bestRatio && (best < 0 || idx < best))) {
            best = idx;
            bestRatio = r;
          }
        }
        if (best >= 0) setCursor(best);
      },
      { root: el, threshold: [0, 0.25, 0.5, 0.75, 1] },
    );

    const slots = el.querySelectorAll<HTMLElement>("[data-page-index]");
    slots.forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, [containerRef, pageCount]);

  return cursor;
}

export function scrollToPageIndex(
  container: HTMLElement,
  pageIndex: number,
): void {
  const slot = container.querySelector(`[data-page-index="${pageIndex}"]`);
  if (slot) {
    slot.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}