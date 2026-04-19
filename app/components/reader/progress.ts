import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";

const DEBOUNCE_MS = 500;

export function useSaveProgress(comicId: string, pageIndex: number): void {
  const fetcher = useFetcher();
  const timer = useRef<number | null>(null);
  const latest = useRef(pageIndex);

  useEffect(() => {
    if (pageIndex === latest.current) return;
    latest.current = pageIndex;

    if (timer.current !== null) {
      window.clearTimeout(timer.current);
    }
    timer.current = window.setTimeout(() => {
      fetcher.submit(
        { comicId, pageIndex: String(pageIndex) },
        { method: "post", action: "/resources/progress" },
      );
    }, DEBOUNCE_MS);
    return () => {
      if (timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
    };
  }, [comicId, pageIndex, fetcher]);

  useEffect(() => {
    function onHide() {
      if (document.visibilityState !== "hidden") return;
      const blob = new Blob(
        [
          JSON.stringify({
            comicId,
            pageIndex: latest.current,
          }),
        ],
        { type: "application/json" },
      );
      navigator.sendBeacon("/resources/progress", blob);
    }
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [comicId]);
}