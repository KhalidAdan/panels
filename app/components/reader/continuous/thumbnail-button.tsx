import { cn } from "#app/lib/misc.js";
import { thumbUrl } from "#app/lib/thumbnails.js";

export const ThumbnailButton = ({
  id,
  index,
  isCurrent,
  ref,
  on,
}: {
  id: string;
  index: number;
  isCurrent: boolean;
  ref: React.RefObject<HTMLButtonElement | null>;
  on: (index: number) => void;
}) => {
  return (
    <button
      key={index}
      ref={isCurrent ? ref : undefined}
      type="button"
      onClick={() => on(index)}
      className={cn(
        "block w-full border-b border-white/10 p-1 transition",
        isCurrent ? "bg-white/10 ring-2 ring-white" : "hover:bg-white/5",
      )}
      aria-label={`Page ${index + 1}`}
    >
      <img
        src={thumbUrl(id, index, "strip")}
        alt=""
        className="aspect-1/2 w-25 object-cover"
        loading="eager"
        decoding="async"
        draggable={false}
      />
      <span className="block text-center text-xs text-white/70">
        {index + 1}
      </span>
    </button>
  );
};
