"use client";

import { type ReactNode, useCallback, useState } from "react";
import { useFocusRestore } from "@/hooks/use-focus-restore";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useCommandPaletteContext } from "./command-palette-context";
import { DialogShell } from "../shared/dialog-shell";
import { PortalContainerProvider } from "../shared/portal-context";

export const commandPaletteContentVariants = cva(
  "relative flex flex-col max-h-[80vh] m-auto w-full font-mono",
  {
    variants: {
      size: { sm: "max-w-sm", md: "max-w-xl", lg: "max-w-2xl" },
      frame: { border: "", viewfinder: "", terminal: "", card: "", none: "" },
      density: { compact: "", comfortable: "", dense: "" },
    },
    defaultVariants: { size: "md", frame: "border", density: "compact" },
  }
);

function getLiveText(search: string, itemCount: number): string {
  if (!search) return "";
  if (itemCount === 0) return "No results";
  return `${itemCount} result${itemCount === 1 ? "" : "s"} available`;
}

export interface CommandPaletteContentProps extends VariantProps<typeof commandPaletteContentVariants> {
  children: ReactNode;
  className?: string;
  label?: string;
}

export function CommandPaletteContent({
  children,
  className,
  size,
  frame,
  density,
  label = "Command palette",
}: CommandPaletteContentProps) {
  const { open, onOpenChange, search, onSearchChange, itemCount, inputRef } = useCommandPaletteContext();
  const [container, setContainer] = useState<Element | null>(null);
  const focusRestore = useFocusRestore({ restoreOnUnmount: false });

  const resolvedFrame = frame ?? "border";
  const resolvedDensity = density ?? "compact";

  // Stable identity for DialogShell's dialogRef callback so the underlying ref isn't re-attached on every render.
  const setDialogRef = useCallback((node: HTMLDialogElement | null) => {
    setContainer(node);
  }, []);

  // Stable identity for DialogShell's onAfterShowModal so focus runs only on open transitions.
  const focusSearchInput = useCallback(() => {
    inputRef.current?.focus();
  }, [inputRef]);

  return (
    <DialogShell
      open={open}
      dialogRef={setDialogRef}
      onBeforeShowModal={focusRestore.capture}
      onAfterShowModal={focusSearchInput}
      onBackdropClick={() => onOpenChange(false)}
      onCancel={() => search ? onSearchChange("") : onOpenChange(false)}
      onClose={focusRestore.restore}
      className={cn(commandPaletteContentVariants({ size, frame, density }), className)}
      data-slot="command-palette-content"
      data-frame={resolvedFrame}
      data-density={resolvedDensity}
      aria-modal="true"
      aria-label={label}
    >
      <PortalContainerProvider container={container}>
        {resolvedFrame === "viewfinder" ? (
          <span aria-hidden="true" className="cp-corners" />
        ) : null}
        {children}
        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {getLiveText(search, itemCount)}
        </div>
      </PortalContainerProvider>
    </DialogShell>
  );
}
