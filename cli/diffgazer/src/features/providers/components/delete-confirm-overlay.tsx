import { usePageFooter } from "@diffgazer/core/footer";
import { DELETE_CONFIGURATION_CONFIRM } from "@diffgazer/core/providers";
import { BACK_SHORTCUT, type Shortcut } from "@diffgazer/core/schemas/presentation";
import { Box, Text } from "ink";
import type { ReactElement } from "react";
import { Button } from "../../../components/ui/button";
import { Dialog } from "../../../components/ui/dialog";
import { useActionRow } from "../../../hooks/use-action-row";

const SWITCH_ACTION_SHORTCUT: Shortcut = { key: "←/→", label: "Switch Action" };
const CANCEL_SHORTCUTS: Shortcut[] = [{ ...BACK_SHORTCUT, label: "Cancel" }];

interface DeleteConfirmOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The provider (or record) whose configuration the confirmation names. */
  name: string;
  onConfirm: () => void;
}

/**
 * The confirmation every configuration removal passes through, whether it came
 * from the More menu or the `d` accelerator: it opens on Cancel, so Enter, a
 * held key or the key that opened it cannot remove anything; Delete is a
 * deliberate move away.
 */
export function DeleteConfirmOverlay({
  open,
  onOpenChange,
  name,
  onConfirm,
}: DeleteConfirmOverlayProps): ReactElement {
  const actions = useActionRow({
    actionCount: 2,
    defaultIndex: 1,
    onAction: (index) => {
      onOpenChange(false);
      if (index === 0) onConfirm();
    },
    isActive: open,
  });
  usePageFooter({
    shortcuts: [
      SWITCH_ACTION_SHORTCUT,
      { key: "Enter", label: actions.activeIndex === 0 ? "Delete" : "Cancel" },
    ],
    rightShortcuts: CANCEL_SHORTCUTS,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>{DELETE_CONFIGURATION_CONFIRM.title}</Dialog.Title>
          <Dialog.Subtitle>{DELETE_CONFIGURATION_CONFIRM.subtitle}</Dialog.Subtitle>
        </Dialog.Header>
        <Dialog.Body>
          <Box marginTop={1}>
            <Text>{DELETE_CONFIGURATION_CONFIRM.body(name)}</Text>
          </Box>
        </Dialog.Body>
        <Dialog.Footer>
          <Box gap={1}>
            <Button
              variant="destructive"
              isActive={actions.isActionActive(0)}
              onPress={() => actions.activate(0)}
            >
              Delete
            </Button>
            <Button
              variant="ghost"
              isActive={actions.isActionActive(1)}
              onPress={() => actions.activate(1)}
            >
              Cancel
            </Button>
          </Box>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  );
}
