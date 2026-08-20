"use client";

import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { FloatingPanel, useFloatingPanelContext } from "@/components/ui/floating-panel";
// @hidden-imports-ok — demo imports the useNavigation re-export from the hidden hook registry item.
import { useNavigation } from "@/hooks/use-navigation";
import { useOutsideClick } from "@/hooks/use-outside-click";
// @hidden-imports-ok: the keys registry installs this utility at the copied local path.
import { getTabbableElements } from "@/hooks/utils/focusable";

const ITEMS = ["Open", "Duplicate", "Delete"] as const;

export default function FloatingPanelCustomMenuExample() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const { onKeyDown: navigateMenu } = useNavigation({
    containerRef: panelRef,
    role: "menuitem",
    moveFocus: true,
    wrap: true,
  });

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  useOutsideClick(panelRef, () => setOpen(false), open, [triggerRef]);

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    switch (event.key) {
      case "Tab": {
        event.preventDefault();
        setOpen(false);
        const trigger = triggerRef.current;
        if (!trigger) break;

        const tabbableElements = getTabbableElements(trigger.ownerDocument.body);
        const triggerIndex = tabbableElements.indexOf(trigger);
        const targetIndex = triggerIndex + (event.shiftKey ? -1 : 1);
        tabbableElements[targetIndex]?.focus();
        break;
      }
      case "Escape":
        event.preventDefault();
        close();
        break;
      default:
        navigateMenu(event);
        break;
    }
  };

  return (
    <div className="flex items-center gap-4">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((value) => !value)}
        className="border border-foreground/30 px-3 py-1 font-mono text-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-0"
      >
        actions
      </button>

      <FloatingPanel
        ref={panelRef}
        open={open}
        triggerRef={triggerRef}
        role="menu"
        aria-label="Actions"
        id={menuId}
        sideOffset={4}
        onKeyDown={handleMenuKeyDown}
        className="min-w-[10rem] rounded-sm border border-border bg-background px-1 py-1 font-mono text-xs text-foreground"
      >
        <MenuItems onSelect={close} />
      </FloatingPanel>
    </div>
  );
}

function MenuItems({ onSelect }: { onSelect: () => void }) {
  const { positioned } = useFloatingPanelContext();
  const firstItemRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (positioned) firstItemRef.current?.focus();
  }, [positioned]);

  return (
    <ul role="presentation" className="list-none">
      {ITEMS.map((item, index) => (
        <li key={item} role="presentation">
          <button
            ref={index === 0 ? firstItemRef : undefined}
            type="button"
            role="menuitem"
            data-value={item.toLowerCase()}
            tabIndex={-1}
            onClick={onSelect}
            className="flex w-full items-center px-2 py-1 text-left hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-0"
          >
            {item}
          </button>
        </li>
      ))}
    </ul>
  );
}
