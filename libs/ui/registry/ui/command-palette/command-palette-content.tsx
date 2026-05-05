"use client";

import { type ReactNode, useRef, useEffect } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useCommandPaletteContext } from "./command-palette-context";
import { DialogShell } from "../shared/dialog-shell";

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
  const { open, onOpenChange, search, onSearchChange, itemCount } = useCommandPaletteContext();
  const previousFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement;
    } else if (previousFocusRef.current) {
      const el = previousFocusRef.current as HTMLElement;
      previousFocusRef.current = null;
      el.focus?.();
    }
  }, [open]);

  return (
    <DialogShell
      open={open}
      onBackdropClick={() => onOpenChange(false)}
      onCancel={() => search ? onSearchChange("") : onOpenChange(false)}
      className={cn(contentVariants({ size }), className)}
      aria-label={label}
    >
      {children}
      <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {getLiveText(search, itemCount)}
      </div>
    </DialogShell>
  );
}
