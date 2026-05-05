import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogClose,
  DialogAction,
  DialogKeyboardHints,
} from "@/components/ui/dialog"

export default function DialogDefault() {
  return (
    <Dialog>
      <DialogTrigger>Open Dialog</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Apply Patch</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="text-sm text-gray-300 leading-relaxed">
            This will modify <span className="text-white font-bold">2 files</span> in <span className="text-foreground font-mono">src/auth/</span>.
            <br />
            Continue?
          </p>
        </DialogBody>
        <DialogFooter>
          <DialogClose bracket variant="ghost">Cancel</DialogClose>
          <DialogAction>Apply</DialogAction>
        </DialogFooter>
        <DialogKeyboardHints hints={[{ key: "Esc", label: "Close" }, { key: "Enter", label: "Confirm" }]} />
      </DialogContent>
    </Dialog>
  )
}
