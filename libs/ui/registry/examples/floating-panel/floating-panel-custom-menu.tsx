"use client";

import { useId, useRef, useState } from "react";
import { FloatingPanel, useFloatingPanelContext } from "@/components/ui/floating-panel";

const ITEMS = ["Open", "Duplicate", "Delete"] as const;

export default function FloatingPanelCustomMenuExample() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuId = useId();

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
        className="min-w-[10rem] border border-border bg-background py-1 font-mono text-xs text-foreground shadow-md"
      >
        <MenuItems onSelect={() => setOpen(false)} />
      </FloatingPanel>
    </div>
  );
}

function MenuItems({ onSelect }: { onSelect: (item: string) => void }) {
  const { positioned } = useFloatingPanelContext();

  return (
    <ul className="list-none" data-positioned={positioned ? "" : undefined}>
      {ITEMS.map((item) => (
        <li key={item}>
          <button
            type="button"
            role="menuitem"
            onClick={() => onSelect(item)}
            className="flex w-full items-center px-2 py-1 text-left hover:bg-muted"
          >
            {item}
          </button>
        </li>
      ))}
    </ul>
  );
}
