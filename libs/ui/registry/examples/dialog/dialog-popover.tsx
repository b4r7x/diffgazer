import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Popover } from "@/components/ui/popover";

export default function DialogPopoverExample() {
  return (
    <Dialog>
      <DialogTrigger>Open nested overlay</DialogTrigger>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>Nested overlay</DialogTitle>
          <DialogDescription>Escape closes one overlay layer at a time.</DialogDescription>
        </DialogHeader>
        <DialogBody className="flex items-center gap-3">
          <Popover>
            <Popover.Trigger>Open popover</Popover.Trigger>
            <Popover.Content
              role="dialog"
              aria-label="Nested popover"
              autoFocus={false}
              className="p-3"
            >
              <button type="button" className="border border-border px-3 py-1 text-sm">
                Popover action
              </button>
            </Popover.Content>
          </Popover>
          <button type="button" className="border border-border px-3 py-1 text-sm">
            Dialog sibling
          </button>
        </DialogBody>
        <DialogFooter>
          <DialogClose>Done</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
