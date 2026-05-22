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
} from "@/components/ui/dialog"
import { InlineCode } from "@/components/ui/code-block"

export default function DialogHeaderFlat() {
  return (
    <Dialog>
      <DialogTrigger>Open Dialog</DialogTrigger>
      <DialogContent className="overflow-hidden">
        <DialogHeader marker="none" className="bg-secondary/50 px-4 py-3">
          <DialogTitle className="tracking-wide">Repository Settings</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="text-sm leading-relaxed">
            <InlineCode>marker=&quot;none&quot;</InlineCode> renders children as direct flex-col
            descendants of the header — no accent bar, no inner wrapper. Use it for
            headers with a background color or a custom horizontal layout where the
            default 4px bar would clash.
          </p>
        </DialogBody>
        <DialogFooter>
          <DialogClose>Cancel</DialogClose>
          <DialogAction>Save</DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
