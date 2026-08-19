import { usePageFooter } from "@diffgazer/core/footer";
import {
  getProviderActionHotkey,
  type ProviderAction,
  type ProviderActionId,
  type ProviderActionLayout,
} from "@diffgazer/core/providers";
import {
  PROVIDER_ACTIONS_MENU_RIGHT_SHORTCUTS,
  PROVIDER_ACTIONS_MENU_SHORTCUTS,
} from "@diffgazer/core/schemas/presentation";
import type { ReactElement } from "react";
import { Fragment } from "react";
import { Dialog } from "../../../components/ui/dialog";
import { Menu } from "../../../components/ui/menu";

interface ProviderActionsOverlayProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The provider the menu acts on, named in the title. */
  title: string;
  layout: ProviderActionLayout;
  onSelect: (action: ProviderAction) => void;
}

/**
 * The More menu: constant entries, an entry the row already shows left out, an
 * entry the state cannot run kept in place, disabled, with its reason in the
 * value column. Delete is last, behind a rule, in the danger colour.
 */
export function ProviderActionsOverlay({
  open,
  onOpenChange,
  title,
  layout,
  onSelect,
}: ProviderActionsOverlayProps): ReactElement {
  usePageFooter({
    shortcuts: PROVIDER_ACTIONS_MENU_SHORTCUTS,
    rightShortcuts: PROVIDER_ACTIONS_MENU_RIGHT_SHORTCUTS,
  });

  const selectEntry = (id: ProviderActionId) => {
    const action = layout.overflow.find((entry) => entry.id === id);
    if (!action || action.disabledReason) return;
    onOpenChange(false);
    onSelect(action);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>{`More actions — ${title}`}</Dialog.Title>
        </Dialog.Header>
        <Dialog.Body>
          <Menu<ProviderActionId> variant="hub" onSelect={selectEntry} isActive={open}>
            {layout.overflow.map((action) => (
              <Fragment key={action.id}>
                {action.id === "delete" ? <Menu.Divider /> : null}
                <Menu.Item
                  id={action.id}
                  disabled={Boolean(action.disabledReason)}
                  variant={action.id === "delete" ? "danger" : "default"}
                  hotkey={getProviderActionHotkey(action)}
                  value={action.disabledReason}
                >
                  {action.label}
                </Menu.Item>
              </Fragment>
            ))}
          </Menu>
        </Dialog.Body>
      </Dialog.Content>
    </Dialog>
  );
}
