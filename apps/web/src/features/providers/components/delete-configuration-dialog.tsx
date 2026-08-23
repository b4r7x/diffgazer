import { DELETE_CONFIGURATION_CONFIRM } from "@diffgazer/core/providers";
import { useActionRowNavigation } from "@diffgazer/keys";
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
import { useDialogScope } from "@/hooks/use-dialog-scope";

interface DeleteConfigurationDialogProps {
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
  useDialogScope("delete-configuration-dialog", { enabled: open });

  const actionRow = useActionRowNavigation({
    enabled: open,
    actionCount: 2,
    onAction: (index) => {
      if (index === 1) onConfirm();
      onOpenChange(false);
    },
    wrap: false,
    defaultZone: "actions",
    defaultIndex: 0,
    canExitActions: false,
  });
  const cancelProps = actionRow.getActionProps(0);
  const deleteProps = actionRow.getActionProps(1);

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
          <DialogClose
            ref={(node) => {
              cancelRef.current = node;
              cancelProps.ref(node);
            }}
            variant="ghost"
            bracket
            highlighted={actionRow.inActions && actionRow.focusedIndex === 0}
            onFocus={cancelProps.onFocus}
          >
            Cancel
          </DialogClose>
          <DialogAction
            ref={deleteProps.ref}
            variant="destructive"
            highlighted={actionRow.inActions && actionRow.focusedIndex === 1}
            onClick={onConfirm}
            onFocus={deleteProps.onFocus}
          >
            Delete
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
