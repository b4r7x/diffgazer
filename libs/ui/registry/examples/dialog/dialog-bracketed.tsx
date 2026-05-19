import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogClose,
  DialogCloseIcon,
  DialogAction,
} from "@/components/ui/dialog"

export default function DialogBracketed() {
  return (
    <Dialog>
      <DialogTrigger>Open Dialog</DialogTrigger>
      <DialogContent frame="border" corners="standard">
        <DialogHeader>
          <DialogTitle meta="CONFIRM">Apply Patch</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="text-sm text-gray-300 leading-relaxed">
            This will modify <span className="text-white font-bold">2 files</span> in <span className="text-foreground font-mono">src/auth/</span>.
            <br />
            Continue?
          </p>
        </DialogBody>
        <DialogFooter hints={[{ key: "Enter", label: "Confirm" }]}>
          <DialogClose bracket variant="ghost">Cancel</DialogClose>
          <DialogAction>Apply</DialogAction>
        </DialogFooter>
        <DialogCloseIcon />
      </DialogContent>
    </Dialog>
  )
}
