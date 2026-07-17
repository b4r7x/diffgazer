"use client";

import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { FloatingPanel, useFloatingPanelContext } from "@/components/ui/floating-panel";

export default function FloatingPanelDefaultExample() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const titleId = useId();

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handlePanelKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    close();
  };

  return (
    <div className="flex items-center gap-4">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
        className="border border-foreground/30 px-3 py-1 font-mono text-sm"
      >
        {open ? "close" : "open panel"}
      </button>

      <FloatingPanel
        open={open}
        triggerRef={triggerRef}
        role="dialog"
        aria-labelledby={titleId}
        id={panelId}
        onKeyDown={handlePanelKeyDown}
        className="border border-border bg-background p-3 font-mono text-xs text-foreground shadow-md"
      >
        <DialogContent titleId={titleId} onDismiss={close} />
      </FloatingPanel>
    </div>
  );
}

function DialogContent({ titleId, onDismiss }: { titleId: string; onDismiss: () => void }) {
  const { positioned } = useFloatingPanelContext();
  const dismissRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (positioned) dismissRef.current?.focus();
  }, [positioned]);

  return (
    <>
      <p id={titleId} className="font-bold">
        Quick info
      </p>
      <p>Anchored panel content.</p>
      <button
        ref={dismissRef}
        type="button"
        className="mt-2 block border border-foreground/30 px-2 py-0.5 text-xs"
        onClick={onDismiss}
      >
        dismiss
      </button>
    </>
  );
}
