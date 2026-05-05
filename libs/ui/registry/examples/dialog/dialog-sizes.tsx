import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogClose,
  DialogKeyboardHints,
} from "@/components/ui/dialog"

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
                This dialog uses the <code className="text-muted-foreground font-mono">{size}</code> size variant.
              </p>
            </DialogBody>
            <DialogFooter>
              <DialogClose bracket variant="ghost">Close</DialogClose>
            </DialogFooter>
            <DialogKeyboardHints hints={[{ key: "Esc", label: "Close" }]} />
          </DialogContent>
        </Dialog>
      ))}
    </div>
  )
}
