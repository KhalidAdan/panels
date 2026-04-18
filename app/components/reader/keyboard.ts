import { useEffect } from "react";

export interface KeyboardHandlers {
  onNext: () => void;
  onPrev: () => void;
  onFirst: () => void;
  onLast: () => void;
  onToggleFullscreen: () => void;
  onJumpTo: () => void;
  onExit: () => void;
}

export function useReaderKeyboard(handlers: KeyboardHandlers): void {
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
        case "ArrowRight":
        case "PageDown":
        case " ":
          if (event.shiftKey && event.key === " ") {
            handlers.onPrev();
          } else {
            handlers.onNext();
          }
          event.preventDefault();
          break;
        case "ArrowLeft":
        case "PageUp":
          handlers.onPrev();
          event.preventDefault();
          break;
        case "Home":
          handlers.onFirst();
          event.preventDefault();
          break;
        case "End":
          handlers.onLast();
          event.preventDefault();
          break;
        case "f":
        case "F":
          handlers.onToggleFullscreen();
          event.preventDefault();
          break;
        case "g":
        case "G":
          handlers.onJumpTo();
          event.preventDefault();
          break;
        case "Escape":
          handlers.onExit();
          event.preventDefault();
          break;
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handlers]);
}