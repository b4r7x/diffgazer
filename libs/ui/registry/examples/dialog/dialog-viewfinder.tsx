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

export default function DialogViewfinder() {
  return (
    <Dialog>
      <DialogTrigger>Open Dialog</DialogTrigger>
      <DialogContent frame="none" corners="standard">
        <DialogHeader>
          <DialogTitle meta="CONFIRM">Apply Patch</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This will modify <span className="text-foreground font-bold">2 files</span> in{" "}
            <span className="text-foreground font-mono">src/auth/</span>.
            <br />
            Continue?
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
  );
}
