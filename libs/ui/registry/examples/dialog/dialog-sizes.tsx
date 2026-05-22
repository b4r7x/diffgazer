import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { InlineCode } from "@/components/ui/code-block"

export default function DialogSizes() {
  return (
    <div className="flex gap-3">
      {(["sm", "md", "lg", "full"] as const).map((size) => (
        <Dialog key={size}>
          <DialogTrigger>{size.toUpperCase()}</DialogTrigger>
          <DialogContent size={size}>
            <DialogHeader>
              <DialogTitle>Size: {size}</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <p className="text-sm text-gray-300">
                This dialog uses the <InlineCode>{size}</InlineCode> size variant.
              </p>
            </DialogBody>
            <DialogFooter hints={[{ key: "Esc", label: "Close" }]}>
              <DialogClose bracket variant="ghost">Close</DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ))}
    </div>
  )
}
