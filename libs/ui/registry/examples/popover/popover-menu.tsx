"use client";

import { Fragment, type KeyboardEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, MenuDivider, MenuItem } from "@/components/ui/menu";
import { Popover } from "@/components/ui/popover";

type ActionId = "copy" | "archive" | "delete";

interface Action {
  id: ActionId;
  label: string;
  hotkey: string;
  /** Present when the current state cannot run the action; the entry stays listed, disabled. */
  disabledReason?: string;
}

const ACTIONS: Action[] = [
  { id: "copy", label: "Copy link", hotkey: "c" },
  { id: "archive", label: "Archive", hotkey: "a", disabledReason: "Already archived" },
  { id: "delete", label: "Delete", hotkey: "d" },
];

/**
 * An actions menu behind one trigger: the trigger's aria-expanded carries the
 * open state, the menu takes focus on open, picking an entry closes it and
 * hands focus back to the trigger, and the destructive entry sits last behind
 * a divider. MenuItem's hotkey is a decorative label; Menu's onKeyDown binds it.
 */
export default function PopoverMenu() {
  const [open, setOpen] = useState(false);
  const [lastAction, setLastAction] = useState<string | null>(null);

  const runAction = (id: ActionId) => {
    const action = ACTIONS.find((entry) => entry.id === id);
    if (!action || action.disabledReason) return;
    setOpen(false);
    setLastAction(action.label);
  };

  const runHotkey = (event: KeyboardEvent) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const action = ACTIONS.find((entry) => !entry.disabledReason && entry.hotkey === event.key);
    if (!action) return;
    event.preventDefault();
    runAction(action.id);
  };

  return (
    <div className="flex flex-col items-start gap-3">
      <Popover open={open} onOpenChange={setOpen} popupRole="menu">
        <Popover.Trigger>
          {(triggerProps) => (
            // A trigger inside a roving-focus row would pass
            // `highlighted={rowHighlight && !open}`: aria-expanded already says the
            // menu is open, so the row's ring must not linger while the menu owns focus.
            <Button {...triggerProps} variant="outline" bracket>
              Actions <span aria-hidden="true">▾</span>
            </Button>
          )}
        </Popover.Trigger>
        <Popover.Content align="start" className="w-64 p-0">
          <Menu<ActionId>
            aria-label="Actions"
            autoFocus
            onClose={() => setOpen(false)}
            onSelect={runAction}
            onKeyDown={runHotkey}
          >
            {ACTIONS.map((action) => (
              <Fragment key={action.id}>
                {action.id === "delete" ? <MenuDivider /> : null}
                <MenuItem
                  id={action.id}
                  disabled={Boolean(action.disabledReason)}
                  variant={action.id === "delete" ? "danger" : "default"}
                  // A disabled entry advertises no key: it would do nothing here.
                  hotkey={action.disabledReason ? undefined : action.hotkey}
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
      <p className="font-mono text-xs text-muted-foreground" aria-live="polite">
        {lastAction ? `Ran: ${lastAction}` : "Nothing run yet"}
      </p>
    </div>
  );
}
