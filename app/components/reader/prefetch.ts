import { useEffect } from "react";

export function usePagePrefetch(
  comicId: string,
  currentIndex: number,
  totalPages: number,
  { behind = 2, ahead = 8 }: { behind?: number; ahead?: number } = {},
): void {
  useEffect(() => {
    const images: HTMLImageElement[] = [];
    for (let delta = -behind; delta <= ahead; delta++) {
      if (delta === 0) continue;
      const index = currentIndex + delta;
      if (index < 0 || index >= totalPages) continue;
      const img = new Image();
      img.decoding = "async";
      img.src = `/resources/page/${comicId}/${index}`;
      images.push(img);
    }
    return () => {
      for (const img of images) img.src = "";
    };
  }, [comicId, currentIndex, totalPages, behind, ahead]);
}