"use client";

import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { FloatingPanel, useFloatingPanelContext } from "@/components/ui/floating-panel";

const ITEMS = ["Open", "Duplicate", "Delete"] as const;

export default function FloatingPanelCustomMenuExample() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleMenuKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'),
    );
    if (items.length === 0) return;
    const currentIndex = items.indexOf(event.target as HTMLButtonElement);

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        items[(currentIndex + 1) % items.length]?.focus();
        break;
      case "ArrowUp":
        event.preventDefault();
        items[(currentIndex - 1 + items.length) % items.length]?.focus();
        break;
      case "Home":
        event.preventDefault();
        items[0]?.focus();
        break;
      case "End":
        event.preventDefault();
        items[items.length - 1]?.focus();
        break;
      case "Escape":
        event.preventDefault();
        close();
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
        className="border border-foreground/30 px-3 py-1 font-mono text-sm"
      >
        actions
      </button>

      <FloatingPanel
        open={open}
        triggerRef={triggerRef}
        role="menu"
        aria-label="Actions"
        id={menuId}
        sideOffset={4}
        onKeyDown={handleMenuKeyDown}
        className="min-w-[10rem] border border-border bg-background py-1 font-mono text-xs text-foreground shadow-md"
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
    <ul role="presentation" className="list-none" data-positioned={positioned ? "" : undefined}>
      {ITEMS.map((item, index) => (
        <li key={item} role="presentation">
          <button
            ref={index === 0 ? firstItemRef : undefined}
            type="button"
            role="menuitem"
            onClick={onSelect}
            className="flex w-full items-center px-2 py-1 text-left hover:bg-muted"
          >
            {item}
          </button>
        </li>
      ))}
    </ul>
  );
}
