import {
  getProviderActionHotkey,
  type ProviderActionId,
  type ProviderActionLayout,
  type ProviderRowControl,
} from "@diffgazer/core/providers";
import { Button } from "@diffgazer/ui/components/button";
import { Chevron } from "@diffgazer/ui/components/icons";
import { Menu, MenuDivider, MenuItem } from "@diffgazer/ui/components/menu";
import { Popover } from "@diffgazer/ui/components/popover";
import { Fragment, type KeyboardEvent, type RefCallback } from "react";

/** The More menu is page state so the page's keys can stand down while it is open. */
export interface ProviderOverflowMenuState {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export interface ProviderOverflowMenuProps {
  /** Derived once per selection so the renderer and the keyboard row cannot diverge. */
  layout: ProviderActionLayout;
  onAction: (control: ProviderRowControl) => void;
  overflowMenu: ProviderOverflowMenuState;
  /** The row's More control; the trigger takes its label. */
  control: ProviderRowControl;
  isPending?: boolean;
  /** The action row's virtual focus sits on the trigger. */
  highlighted?: boolean;
  /** Focus custody from the action row's keyboard navigation. */
  buttonProps?: {
    ref: RefCallback<HTMLElement>;
    onFocus: () => void;
  };
}

/**
 * The More menu: constant entries, an entry the row already shows left out, an
 * entry the state cannot run kept in place, disabled, with its reason in the
 * row. Delete is last, behind a divider, in the danger colour.
 */
export function ProviderOverflowMenu({
  layout,
  onAction,
  overflowMenu,
  control,
  isPending = false,
  highlighted = false,
  buttonProps,
}: ProviderOverflowMenuProps) {
  const selectEntry = (id: ProviderActionId) => {
    const action = layout.overflow.find((entry) => entry.id === id);
    if (!action) return;
    overflowMenu.onOpenChange(false);
    onAction(action);
  };

  // The key an entry advertises runs it while the menu is open, as in the TUI
  // menu; the page's own accelerators are off while the menu owns focus. Delete
  // runs into its confirmation, so a repeated or held key cannot remove anything.
  const runEntryHotkey = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const action = layout.overflow.find(
      (entry) => !entry.disabledReason && getProviderActionHotkey(entry) === event.key,
    );
    if (!action) return;
    event.preventDefault();
    selectEntry(action.id);
  };

  return (
    <Popover open={overflowMenu.open} onOpenChange={overflowMenu.onOpenChange} popupRole="menu">
      <Popover.Trigger ref={buttonProps?.ref}>
        {(triggerProps) => (
          <Button
            {...triggerProps}
            onFocus={buttonProps?.onFocus}
            variant="outline"
            bracket
            disabled={isPending}
            // The row's ring is a virtual-focus cue; while the menu owns focus,
            // aria-expanded and the menu's highlighted item carry the state, and
            // the ring would only recolor the edge the panel aligns to.
            highlighted={highlighted && !overflowMenu.open}
            aria-label="More actions"
          >
            {/* One inline-flex child: the button's min-w-0 content span may
                shrink below content width, which wrapped the chevron under the
                label; nowrap + explicit gap keep [More ⌄] on one line. */}
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              {control.label}
              <Chevron direction="down" size="sm" className="shrink-0" />
            </span>
          </Button>
        )}
      </Popover.Trigger>
      <Popover.Content align="start" className="w-80 p-0">
        <Menu<ProviderActionId>
          aria-label="More actions"
          autoFocus
          onClose={() => overflowMenu.onOpenChange(false)}
          onSelect={selectEntry}
          onKeyDown={runEntryHotkey}
        >
          {layout.overflow.map((action) => (
            <Fragment key={action.id}>
              {action.id === "delete" ? <MenuDivider /> : null}
              <MenuItem
                id={action.id}
                disabled={Boolean(action.disabledReason)}
                variant={action.id === "delete" ? "danger" : "default"}
                // A disabled entry advertises no key: the key does nothing in this state.
                hotkey={action.disabledReason ? undefined : getProviderActionHotkey(action)}
              >
                {action.label}
                {action.disabledReason ? (
                  <span className="block text-2xs text-muted-foreground">
                    {action.disabledReason}
                  </span>
                ) : null}
              </MenuItem>
            </Fragment>
          ))}
        </Menu>
      </Popover.Content>
    </Popover>
  );
}
