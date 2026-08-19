import { DELETE_CONFIGURATION_CONFIRM } from "@diffgazer/core/providers";
import { useScope } from "@diffgazer/keys";
import {
  Dialog,
  DialogAction,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@diffgazer/ui/components/dialog";
import { useRef } from "react";

export interface DeleteConfigurationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The provider (or record) whose configuration the confirmation names. */
  name: string;
  onConfirm: () => void;
}

/**
 * The confirmation every configuration removal passes through, whether it came
 * from the More menu, its `d` accelerator or a pointer: an alert dialog whose
 * safe action holds the initial focus, so Enter or a held key cannot delete.
 */
export function DeleteConfigurationDialog({
  open,
  onOpenChange,
  name,
  onConfirm,
}: DeleteConfigurationDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  useScope("delete-configuration-dialog", { enabled: open });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        role="alertdialog"
        size="sm"
        closeIcon={false}
        closeOnBackdropClick={false}
        initialFocus={cancelRef}
      >
        <DialogHeader>
          <DialogTitle className="shrink-0">{DELETE_CONFIGURATION_CONFIRM.title}</DialogTitle>
          <DialogDescription>{DELETE_CONFIGURATION_CONFIRM.subtitle}</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <p className="text-sm leading-relaxed">{DELETE_CONFIGURATION_CONFIRM.body(name)}</p>
        </DialogBody>
        <DialogFooter hints={[{ key: "Esc", label: "Cancel" }]}>
          <DialogClose ref={cancelRef} variant="ghost" bracket>
            Cancel
          </DialogClose>
          <DialogAction variant="destructive" onClick={onConfirm}>
            Delete
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
