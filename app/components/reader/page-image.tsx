import { cn } from "#app/lib/misc";
import { useEffect, useState } from "react";

export function PageImage({
  comicId,
  pageIndex,
  totalPages,
  className,
  imgClassName,
}: {
  comicId: string;
  pageIndex: number;
  totalPages: number;
  className?: string;
  imgClassName?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const src = `/resources/page/${comicId}/${pageIndex}`;

  useEffect(() => {
    setLoaded(false);
    setErrored(false);
  }, [src]);

  return (
    <div
      className={cn(
        "relative flex h-full w-full items-center justify-center",
        className,
      )}
    >
      {!loaded && !errored ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm text-muted-foreground">Loading…</span>
        </div>
      ) : null}

      {errored ? (
        <div className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
          <span>Failed to load page {pageIndex + 1}.</span>
        </div>
      ) : (
        <img
          key={src}
          src={src}
          alt={`Page ${pageIndex + 1} of ${totalPages}`}
          className={cn(
            "transition-opacity",
            loaded ? "opacity-100" : "opacity-0",
            imgClassName ?? "max-h-full max-w-full object-contain",
          )}
          loading="eager"
          decoding="async"
          fetchPriority="high"
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
        />
      )}
    </div>
  );
}
