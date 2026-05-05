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
import { Button } from "@/components/ui/button"

export default function DialogCustomTrigger() {
  return (
    <Dialog>
      <DialogTrigger>
        {(triggerProps) => (
          <Button {...triggerProps} variant="ghost">
            Open Dialog
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Custom Trigger</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="text-sm text-gray-300 leading-relaxed">
            This dialog was opened from a <span className="font-mono text-foreground">&lt;Button&gt;</span> using the render-prop pattern, avoiding <span className="font-mono text-foreground">&lt;button&gt;&lt;button&gt;</span> nesting.
          </p>
        </DialogBody>
        <DialogFooter>
          <DialogClose bracket variant="ghost">Close</DialogClose>
          <DialogAction>Confirm</DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
