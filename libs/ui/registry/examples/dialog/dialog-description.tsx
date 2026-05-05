import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogClose,
  DialogAction,
  DialogKeyboardHints,
} from "@/components/ui/dialog"

export default function DialogDescriptionExample() {
  return (
    <Dialog>
      <DialogTrigger>Reset Config</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset Configuration</DialogTitle>
          <DialogDescription>
            This will restore all settings to their default values.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <p className="text-sm text-gray-300 leading-relaxed">
            Your current config in <span className="text-foreground font-mono">.diffgazer/config.json</span> will be overwritten.
            A backup will be saved as <span className="text-foreground font-mono">config.json.bak</span>.
          </p>
        </DialogBody>
        <DialogFooter>
          <DialogClose bracket variant="ghost">Cancel</DialogClose>
          <DialogAction>Reset</DialogAction>
        </DialogFooter>
        <DialogKeyboardHints hints={[{ key: "Esc", label: "Close" }, { key: "Enter", label: "Confirm" }]} />
      </DialogContent>
    </Dialog>
  )
}
