import {
  Dialog,
  DialogAction,
  DialogBody,
  DialogClose,
  DialogCloseIcon,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// modal={false} renders the dialog chrome in the document flow — same frame,
// corners, header strip, eyebrow, and footer as the modal, without the
// backdrop, focus trap, or top layer. That keeps the open state reviewable on a
// static page. Product code opens a modal from a Dialog.Trigger instead. An
// inline dialog gets no automatic [x], so the first one composes DialogCloseIcon.
export default function DialogInlineExample() {
  return (
    <div className="flex flex-col gap-10">
      <Dialog open>
        <DialogContent modal={false} size="sm" corners="standard">
          <DialogHeader>
            <DialogTitle meta="CONFIRM">Apply Patch</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-muted-foreground leading-relaxed">
              This will modify <span className="text-foreground font-bold">2 files</span> in{" "}
              <span className="text-foreground font-mono">src/auth/</span>.
            </p>
          </DialogBody>
          <DialogFooter hints={[{ key: "Esc", label: "Close" }]}>
            <DialogClose bracket>Cancel</DialogClose>
            <DialogAction>Apply</DialogAction>
          </DialogFooter>
          <DialogCloseIcon />
        </DialogContent>
      </Dialog>

      <Dialog open>
        <DialogContent modal={false} size="sm" corners="bold">
          <DialogHeader>
            <DialogTitle meta="DESTRUCTIVE">Delete Repository</DialogTitle>
            <DialogDescription>This action is permanent and cannot be undone.</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-muted-foreground leading-relaxed">
              All files, commits, and branches in{" "}
              <span className="text-foreground font-mono">voitz/diffgazer</span> are removed.
            </p>
          </DialogBody>
          <DialogFooter hints={[{ key: "Esc", label: "Close" }]}>
            <DialogClose bracket>Cancel</DialogClose>
            <DialogAction variant="destructive">Delete</DialogAction>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
