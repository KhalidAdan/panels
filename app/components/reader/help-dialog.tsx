import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "#app/components/ui/dialog";

export function HelpDialog({
  open,
  onOpenChange,
  isRTL,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isRTL: boolean;
}) {
  const forward = isRTL ? "←" : "→";
  const back = isRTL ? "→" : "←";

  const rows: Array<[string, string]> = [
    [`${forward} / PageDown / Space`, "Next page"],
    [`${back} / PageUp / Shift+Space`, "Previous page"],
    ["Home", "First page"],
    ["End", "Last page"],
    ["F", "Toggle fullscreen"],
    ["G", "Jump to page"],
    ["T", "Toggle thumbnail strip"],
    ["D", "Toggle double-page spread"],
    ["1 / 2 / 3", "Fit: screen / width / height"],
    ["B", "Cycle background color"],
    ["R", "Cycle reading direction (auto → LTR → RTL)"],
    ["?", "Show this help"],
    ["Esc", "Exit reader / close dialog"],
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            {isRTL
              ? "Right-to-left mode — arrows reflect reading order."
              : "Left-to-right mode."}
          </DialogDescription>
        </DialogHeader>
        <table className="w-full text-sm">
          <tbody>
            {rows.map(([key, description]) => (
              <tr key={key} className="border-t border-border">
                <td className="py-1.5 pr-4">
                  <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-xs">
                    {key}
                  </kbd>
                </td>
                <td className="py-1.5 text-muted-foreground">{description}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DialogContent>
    </Dialog>
  );
}