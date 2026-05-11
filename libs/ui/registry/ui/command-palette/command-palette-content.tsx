"use client";

import { type ReactNode, useCallback, useState } from "react";
import { useFocusRestore } from "@/hooks/use-focus-restore";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useCommandPaletteContext } from "./command-palette-context";
import { DialogShell } from "../shared/dialog-shell";
import { PortalContainerProvider } from "../shared/portal-context";

const contentVariants = cva(
  "border-2 border-border shadow-[0_0_40px_rgba(0,0,0,0.5)] bg-background relative flex flex-col max-h-[80vh] m-auto outline outline-1 outline-border/50 outline-offset-[1px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
  {
    variants: {
      size: { sm: "max-w-sm", md: "max-w-xl", lg: "max-w-2xl" },
    },
    defaultVariants: { size: "md" },
  }
);

function getLiveText(search: string, itemCount: number): string {
  if (!search) return "";
  if (itemCount === 0) return "No results";
  return `${itemCount} result${itemCount === 1 ? "" : "s"} available`;
}

export interface CommandPaletteContentProps extends VariantProps<typeof contentVariants> {
  children: ReactNode;
  className?: string;
  label?: string;
}

export function CommandPaletteContent({ children, className, size, label = "Command palette" }: CommandPaletteContentProps) {
  const { open, onOpenChange, search, onSearchChange, itemCount, inputRef } = useCommandPaletteContext();
  const [container, setContainer] = useState<Element | null>(null);
  const focusRestore = useFocusRestore({ restoreOnUnmount: false });

  const setDialogRef = useCallback((node: HTMLDialogElement | null) => {
    setContainer(node);
  }, []);

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
      className={cn(contentVariants({ size }), className)}
      aria-modal="true"
      aria-label={label}
    >
      <PortalContainerProvider container={container}>
        {children}
        <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
          {getLiveText(search, itemCount)}
        </div>
      </PortalContainerProvider>
    </DialogShell>
  );
}
