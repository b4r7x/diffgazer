import { Dialog } from "@/components/ui/dialog";
import { Popover } from "@/components/ui/popover";

export default function DialogPopoverExample() {
  return (
    <Dialog>
      <Dialog.Trigger>Open nested overlay</Dialog.Trigger>
      <Dialog.Content size="sm">
        <Dialog.Header>
          <Dialog.Title>Nested overlay</Dialog.Title>
          <Dialog.Description>Escape closes one overlay layer at a time.</Dialog.Description>
        </Dialog.Header>
        <Dialog.Body className="flex items-center gap-3">
          <Popover>
            <Popover.Trigger>Open popover</Popover.Trigger>
            <Popover.Content
              role="dialog"
              aria-label="Nested popover"
              autoFocus={false}
              className="border border-border bg-background p-3 shadow-md"
            >
              <button type="button" className="border border-border px-3 py-1 text-sm">
                Popover action
              </button>
            </Popover.Content>
          </Popover>
          <button type="button" className="border border-border px-3 py-1 text-sm">
            Dialog sibling
          </button>
        </Dialog.Body>
        <Dialog.Footer>
          <Dialog.Close>Done</Dialog.Close>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
