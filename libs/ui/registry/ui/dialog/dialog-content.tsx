"use client";

import {
  Children,
  isValidElement,
  useCallback,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
} from "react";
import { useFocusRestore } from "@/hooks/use-focus-restore";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { useDialogContext } from "./dialog-context";
import { DialogTitle } from "./dialog-title";
import { DialogDescription } from "./dialog-description";
import { DialogShell } from "../shared/dialog-shell";
import { PortalContainerProvider } from "../shared/portal-context";

export const dialogContentVariants = cva(
  "relative w-full max-h-[90vh] flex flex-col bg-background text-foreground shadow-2xl m-auto",
  {
    variants: {
      size: {
        sm: "max-w-sm",
        md: "max-w-2xl",
        lg: "max-w-4xl",
        full: "max-w-full",
      },
      frame: {
        border: "border border-border",
        none: "",
      },
      corners: {
        none: "",
        subtle: "",
        standard: "",
        bold: "",
        outset: "",
      },
    },
    defaultVariants: {
      size: "md",
      frame: "border",
      corners: "none",
    },
  }
);

/** Runtime fallback when no accessible name is provided. Devs should supply a real name via Dialog.Title, aria-label, or aria-labelledby. */
const FALLBACK_DIALOG_LABEL = "Dialog";

export interface DialogContentProps
  extends VariantProps<typeof dialogContentVariants>,
    Omit<HTMLAttributes<HTMLDialogElement>, "children" | "className"> {
  children: ReactNode;
  className?: string;
  role?: "dialog" | "alertdialog";
  closeOnBackdropClick?: boolean;
  initialFocus?: RefObject<HTMLElement | null>;
  onCancel?: (e: SyntheticEvent<HTMLDialogElement>) => void;
  onEscapeKeyDown?: (e: SyntheticEvent<HTMLDialogElement>) => void;
}

function hasNonEmptyText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

type AccessibleNameInput = {
  ariaLabel: string | undefined;
  ariaLabelledBy: string | undefined;
  titleId: string;
  hasRenderableTitle: boolean;
};

type AccessibleNameOutput = {
  "aria-label": string | undefined;
  "aria-labelledby": string | undefined;
};

/**
 * Precedence: aria-labelledby > aria-label > Dialog.Title > fallback ("Dialog").
 * Exactly one of aria-label / aria-labelledby is set; the other is undefined.
 */
function resolveAccessibleName({
  ariaLabel,
  ariaLabelledBy,
  titleId,
  hasRenderableTitle,
}: AccessibleNameInput): AccessibleNameOutput {
  if (hasNonEmptyText(ariaLabelledBy)) {
    return { "aria-label": undefined, "aria-labelledby": ariaLabelledBy };
  }
  if (hasNonEmptyText(ariaLabel)) {
    return { "aria-label": ariaLabel, "aria-labelledby": undefined };
  }
  if (hasRenderableTitle) {
    return { "aria-label": undefined, "aria-labelledby": titleId };
  }
  return { "aria-label": FALLBACK_DIALOG_LABEL, "aria-labelledby": undefined };
}

export function DialogContent({
  children,
  className,
  size,
  frame,
  corners,
  closeOnBackdropClick = true,
  initialFocus,
  onEscapeKeyDown,
  onCancel,
  onAnimationEnd,
  "aria-label": ariaLabel,
  "aria-labelledby": ariaLabelledBy,
  ...rest
}: DialogContentProps) {
  const { open, onOpenChange, contentId, titleId, descriptionId, triggerRef } = useDialogContext();
  const close = () => onOpenChange(false);
  const shellRef = useRef<HTMLDialogElement>(null);
  const [container, setContainer] = useState<Element | null>(null);
  const focusRestore = useFocusRestore({
    fallback: triggerRef.current,
    restoreOnUnmount: false,
  });
  const hasAriaLabel = hasNonEmptyText(ariaLabel);
  const hasAriaLabelledBy = hasNonEmptyText(ariaLabelledBy);
  const hasRenderableTitle = containsDialogTitleElement(children);
  const hasRenderableDescription = containsDialogDescriptionElement(children);
  const resolvedFrame = frame ?? "border";
  const resolvedCorners = corners ?? "none";
  const accessibleName = resolveAccessibleName({
    ariaLabel,
    ariaLabelledBy,
    titleId,
    hasRenderableTitle,
  });

  const setShellRef = useCallback((node: HTMLDialogElement | null) => {
    shellRef.current = node;
    setContainer(node);
  }, []);

  useEffect(() => {
    if (!open) return;
    if (hasAriaLabel || hasAriaLabelledBy || hasRenderableTitle) return;
    console.warn(
      "[DialogContent] Missing accessible name. Precedence: aria-labelledby > aria-label > Dialog.Title > fallback. Fix: add <Dialog.Title>, pass aria-label=\"...\", or wrap the title in <VisuallyHidden> if it must be visually hidden. A fallback \"Dialog\" label is applied at runtime.",
    );
  }, [open, hasAriaLabel, hasAriaLabelledBy, hasRenderableTitle]);

  return (
    <DialogShell
      {...rest}
      open={open}
      id={contentId}
      dialogRef={setShellRef}
      initialFocus={initialFocus}
      onBackdropClick={closeOnBackdropClick ? close : undefined}
      onCancel={(e) => {
        onCancel?.(e);
        if (e.defaultPrevented) return;
        onEscapeKeyDown?.(e);
        if (!e.defaultPrevented) close();
      }}
      onBeforeShowModal={focusRestore.capture}
      onClose={focusRestore.restore}
      onAnimationEnd={onAnimationEnd}
      className={cn(dialogContentVariants({ size, frame, corners }), className)}
      data-slot="dialog-content"
      data-frame={resolvedFrame}
      data-corners={resolvedCorners}
      aria-modal="true"
      aria-label={accessibleName["aria-label"]}
      aria-labelledby={accessibleName["aria-labelledby"]}
      aria-describedby={hasRenderableDescription ? descriptionId : undefined}
    >
      <PortalContainerProvider container={container}>
        {resolvedCorners !== "none" ? (
          <span aria-hidden="true" className="dlg-corners" />
        ) : null}
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

function containsDialogDescriptionElement(children: ReactNode): boolean {
  return Children.toArray(children).some((child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return false;
    if (child.type === DialogDescription) return true;
    return containsDialogDescriptionElement(child.props.children);
  });
}
