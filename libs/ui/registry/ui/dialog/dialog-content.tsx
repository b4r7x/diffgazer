"use client";

import {
  Children,
  isValidElement,
  useCallback,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
  type SyntheticEvent,
} from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useDialogContext } from "./dialog-context";
import { DialogTitle } from "./dialog-title";
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
  onCancel?: (e: SyntheticEvent<HTMLDialogElement>) => void;
  onEscapeKeyDown?: (e: SyntheticEvent<HTMLDialogElement>) => void;
}

function hasNonEmptyText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function DialogContent({
  children,
  className,
  size,
  closeOnBackdropClick = true,
  onEscapeKeyDown,
  onCancel,
  onAnimationEnd,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...rest
}: DialogContentProps) {
  const { open, onOpenChange, contentId, titleId, descriptionId, hasTitle, hasDescription, triggerRef } = useDialogContext();
  const close = () => onOpenChange(false);
  const shellRef = useRef<HTMLDialogElement>(null);
  const [container, setContainer] = useState<Element | null>(null);
  const hasAriaLabel = hasNonEmptyText(ariaLabel);
  const hasAriaLabelledBy = hasNonEmptyText(ariaLabelledBy);
  const hasRenderableTitle = hasTitle || containsDialogTitleElement(children);
  const labelledBy = hasAriaLabelledBy ? ariaLabelledBy : hasAriaLabel || !hasRenderableTitle ? undefined : titleId;

  const setShellRef = useCallback((node: HTMLDialogElement | null) => {
    shellRef.current = node;
    setContainer(node);
  }, []);

  return (
    <DialogShell
      {...rest}
      open={open}
      id={contentId}
      dialogRef={setShellRef}
      onBackdropClick={closeOnBackdropClick ? close : undefined}
      onCancel={(e) => {
        onCancel?.(e);
        if (e.defaultPrevented) return;
        onEscapeKeyDown?.(e);
        if (!e.defaultPrevented) close();
      }}
      onClose={() => triggerRef.current?.focus()}
      onAnimationEnd={onAnimationEnd}
      className={cn(dialogContentVariants({ size }), className)}
      aria-modal="true"
      aria-label={hasAriaLabel ? ariaLabel : undefined}
      aria-labelledby={labelledBy}
      aria-describedby={hasDescription ? descriptionId : undefined}
    >
      <PortalContainerProvider container={container}>
        {children}
      </PortalContainerProvider>
    </DialogShell>
  );
}

function containsDialogTitleElement(children: ReactNode): boolean {
  return Children.toArray(children).some((child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return false;
    if (child.type === DialogTitle) return true;
    return containsDialogTitleElement(child.props.children);
  });
}
