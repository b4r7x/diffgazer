import { InlineCode } from "@/components/ui/code-block";
import {
  Dialog,
  DialogAction,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function DialogCorners() {
  return (
    <div className="flex flex-wrap gap-3">
      {(["subtle", "standard", "bold", "outset"] as const).map((corners) => (
        <Dialog key={corners}>
          <DialogTrigger>{corners.toUpperCase()}</DialogTrigger>
          <DialogContent frame="none" corners={corners}>
            <DialogHeader>
              <DialogTitle meta="CONFIRM">Apply Patch</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Corner marks: <InlineCode>{corners}</InlineCode>. This will modify{" "}
                <span className="text-foreground font-bold">2 files</span> in{" "}
                <span className="text-foreground font-mono">src/auth/</span>.
              </p>
            </DialogBody>
            <DialogFooter hints={[{ key: "Esc", label: "Close" }]}>
              <DialogClose bracket variant="ghost">
                Cancel
              </DialogClose>
              <DialogAction>Apply</DialogAction>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ))}
    </div>
  );
}
