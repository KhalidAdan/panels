import { useEffect, useRef } from "react";
import { Button } from "#app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "#app/components/ui/dialog";
import { Input } from "#app/components/ui/input";
import { Label } from "#app/components/ui/label";

export function JumpToPageDialog({
  open,
  onOpenChange,
  currentPage,
  totalPages,
  onJump,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPage: number;
  totalPages: number;
  onJump: (index: number) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const id = window.setTimeout(() => inputRef.current?.select(), 50);
    return () => window.clearTimeout(id);
  }, [open]);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const raw = (form.elements.namedItem("page") as HTMLInputElement).value;
    const asNumber = Number(raw);
    if (!Number.isFinite(asNumber)) return;
    const clamped = Math.min(Math.max(1, Math.round(asNumber)), totalPages);
    onJump(clamped - 1);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Jump to page</DialogTitle>
          <DialogDescription>
            Enter a page number between 1 and {totalPages}.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="page">Page</Label>
            <Input
              id="page"
              name="page"
              type="number"
              min={1}
              max={totalPages}
              defaultValue={currentPage + 1}
              ref={inputRef}
              inputMode="numeric"
              autoComplete="off"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Go</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}