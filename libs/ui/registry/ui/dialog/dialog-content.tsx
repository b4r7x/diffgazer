"use client";

import { useRef, useState, useLayoutEffect, type HTMLAttributes, type ReactNode, type SyntheticEvent } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useDialogContext } from "./dialog-context";
import { DialogShell } from "../shared/dialog-shell";
import { PortalContainerProvider } from "../shared/portal-context";

const dialogContentVariants = cva(
  "relative w-full max-h-[90vh] flex flex-col bg-background text-foreground border border-border shadow-2xl m-auto",
  {
    variants: {
      size: {
        sm: "max-w-sm",
        md: "max-w-2xl",
        lg: "max-w-4xl",
        full: "max-w-full",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

export interface DialogContentProps
  extends VariantProps<typeof dialogContentVariants>,
    Omit<HTMLAttributes<HTMLDialogElement>, "children" | "className"> {
  children: ReactNode;
  className?: string;
  role?: "dialog" | "alertdialog";
  closeOnBackdropClick?: boolean;
  onEscapeKeyDown?: (e: SyntheticEvent<HTMLDialogElement>) => void;
}

export function DialogContent({ children, className, size, closeOnBackdropClick = true, onEscapeKeyDown, ...rest }: DialogContentProps) {
  const { open, onOpenChange, contentId, titleId, descriptionId, hasDescription, triggerRef } = useDialogContext();
  const close = () => onOpenChange(false);
  const shellRef = useRef<HTMLDialogElement>(null);
  const [container, setContainer] = useState<Element | null>(null);

  useLayoutEffect(() => {
    setContainer(shellRef.current);
  }, []);

  return (
    <DialogShell
      {...rest}
      open={open}
      id={contentId}
      dialogRef={shellRef}
      onBackdropClick={closeOnBackdropClick ? close : undefined}
      onCancel={(e) => {
        onEscapeKeyDown?.(e);
        if (!e.defaultPrevented) close();
      }}
      onClose={() => triggerRef.current?.focus()}
      className={cn(dialogContentVariants({ size }), className)}
      aria-labelledby={titleId}
      aria-describedby={hasDescription ? descriptionId : undefined}
    >
      <PortalContainerProvider container={container}>
        {children}
      </PortalContainerProvider>
    </DialogShell>
  );
}
