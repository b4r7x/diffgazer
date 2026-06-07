import { InlineCode } from "@/components/ui/code-block";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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
              <DialogClose bracket variant="ghost">
                Close
              </DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      ))}
    </div>
  );
}
