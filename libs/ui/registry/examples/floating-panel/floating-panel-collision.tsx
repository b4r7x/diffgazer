"use client";

import { type KeyboardEvent, useEffect, useId, useRef, useState } from "react";
import { FloatingPanel, useFloatingPanelContext } from "@/components/ui/floating-panel";

const TRIGGER_CLASS =
  "border border-foreground/30 px-3 py-1 font-mono text-sm focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2";

export default function FloatingPanelCollisionExample() {
  return (
    <div className="flex w-full items-center justify-between gap-4">
      <EdgePanel side="left" label="open left-edge panel" />
      <EdgePanel side="right" label="open right-edge panel" />
    </div>
  );
}

function EdgePanel({ side, label }: { side: "left" | "right"; label: string }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const titleId = useId();

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Escape") return;
    event.preventDefault();
    close();
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((value) => !value)}
        className={TRIGGER_CLASS}
      >
        {open ? "close" : label}
      </button>

      <FloatingPanel
        open={open}
        triggerRef={triggerRef}
        role="dialog"
        aria-labelledby={titleId}
        id={panelId}
        side={side}
        onKeyDown={handleKeyDown}
        className="w-64 rounded-sm border border-border bg-background p-3 font-mono text-xs text-foreground"
      >
        <CollisionDialogContent open={open} titleId={titleId} side={side} onDismiss={close} />
      </FloatingPanel>
    </>
  );
}

function CollisionDialogContent({
  open,
  titleId,
  side,
  onDismiss,
}: {
  open: boolean;
  titleId: string;
  side: "left" | "right";
  onDismiss: () => void;
}) {
  const { positioned } = useFloatingPanelContext();
  const dismissRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open && positioned) dismissRef.current?.focus();
  }, [open, positioned]);

  return (
    <>
      <p id={titleId} className="font-bold">
        Collision handling
      </p>
      <p className="mt-1">
        Requested side="{side}". With no room on that side the panel flips to the opposite side,
        then shifts to stay inside the viewport. The resolved values land on data-side and
        data-align.
      </p>
      <button
        ref={dismissRef}
        type="button"
        onClick={onDismiss}
        className="mt-3 border border-foreground/30 px-2 py-1 focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2"
      >
        close panel
      </button>
    </>
  );
}
