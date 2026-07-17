"use client";

import { cva, type VariantProps } from "class-variance-authority";
import {
  Children,
  type ComponentProps,
  isValidElement,
  type ReactNode,
  type RefObject,
  type SyntheticEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useFocusRestore } from "@/hooks/use-focus-restore";
import { mergeIds } from "@/lib/aria";
import { cn } from "@/lib/utils";
import { DialogShell } from "../shared/dialog-shell";
import { PortalContainerProvider } from "../shared/portal-context";
import { Dialog as DialogRoot } from "./dialog";
import { useDialogContext } from "./dialog-context";
import { DialogDescription } from "./dialog-description";
import { DialogTitle } from "./dialog-title";

/**
 * Modal dialog with compound component architecture. Built on the native dialog element with
 * two orthogonal visual axes: frame (border or none) and corners (none, subtle, standard, bold,
 * or outset), and an optional header marker bar spanning the title and description.
 */
export type DialogCorners = "none" | "subtle" | "standard" | "bold" | "outset";

/** Class variants for dialog content. */
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
    },
    defaultVariants: {
      size: "md",
      frame: "border",
    },
  },
);

const FALLBACK_DIALOG_LABEL = "Dialog";

/** Props for dialog content. */
export interface DialogContentProps
  extends VariantProps<typeof dialogContentVariants>,
    Omit<ComponentProps<"dialog">, "children" | "className"> {
  /** Content rendered inside the component. */
  children: ReactNode;
  /** Additional class names merged onto the rendered element. */
  className?: string;
  /**
   * Corner accent marks drawn at the dialog corners. "none" skips them. "subtle" uses border
   * color and tighter 12px arms. "standard" uses foreground color 18px arms. "bold" uses
   * foreground color 28px arms. "outset" is standard shifted 3px outside the dialog edge.
   * Combine with frame="none" for a pure viewfinder look or frame="border" for a
   * bracketed-frame look.
   */
  corners?: DialogCorners | null;
  /**
   * Set role="alertdialog" for destructive confirmations. Per WAI-ARIA APG, alert dialogs
   * should not close on outside interaction.
   */
  role?: "dialog" | "alertdialog";
  /** When false, clicking the backdrop does not close the dialog (recommended for alertdialog). */
  closeOnBackdropClick?: boolean;
  /** Element that receives focus when the overlay opens. */
  initialFocus?: RefObject<HTMLElement | null>;
  /** Native cancel handler. Defaults to closing the dialog. */
  onCancel?: (e: SyntheticEvent<HTMLDialogElement>) => void;
  /**
   * Intercept cancelable Escape dismissal. Call e.preventDefault() to keep the dialog open during
   * async operations; if the native dialog is force-closed without a cancelable cancel event, the
   * shell reopens it while React `open` is still true.
   */
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

/**
 * Provide an accessible name through one of three paths (precedence order):
 *
 * 1. `aria-labelledby` pointing at existing element id(s);
 * 2. an explicit `aria-label` string;
 * 3. a rendered `<Dialog.Title>`, whose id is wired automatically.
 *
 * ```tsx
 * <Dialog.Content><Dialog.Title>Settings</Dialog.Title>…</Dialog.Content>
 * <Dialog.Content aria-label="Settings">…</Dialog.Content>
 * <Dialog.Content aria-labelledby="settings-heading">…</Dialog.Content>
 * ```
 *
 * When a consumer component hides the title or description from the static child tree, pass
 * native `aria-label` and `aria-description` attributes so both are present during SSR.
 *
 * If none are present the dialog falls back to the label "Dialog" and warns in
 * dev so the dialog still has a usable name rather than failing to open.
 */
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
  "aria-description": ariaDescription,
  "aria-describedby": ariaDescribedBy,
  ...rest
}: DialogContentProps) {
  const {
    open,
    onOpenChange,
    contentId,
    titleId,
    descriptionId,
    triggerRef,
    hasRegisteredTitle,
    hasRegisteredDescription,
  } = useDialogContext();
  const close = () => onOpenChange(false);
  const shellRef = useRef<HTMLDialogElement>(null);
  const [container, setContainer] = useState<Element | null>(null);
  const focusRestore = useFocusRestore({ restoreOnUnmount: true });
  // Restore focus to the captured opener; fall back to the trigger ref read at
  // restore time (not during render) so a programmatically-opened dialog still
  // returns focus somewhere sensible.
  const handleClose = useCallback(() => {
    const view = shellRef.current?.ownerDocument.defaultView ?? globalThis;
    view.requestAnimationFrame(() => {
      if (!focusRestore.restore()) triggerRef.current?.focus();
    });
  }, [focusRestore, triggerRef]);
  // Registration covers parts rendered through consumer wrapper components; the
  // static child scan seeds the first render before the registration effects run.
  const hasRenderableTitle = hasRegisteredTitle || containsDialogTitleElement(children);
  const hasRenderableDescription =
    hasRegisteredDescription || containsDialogDescriptionElement(children);
  const resolvedFrame = frame ?? "border";
  const resolvedCorners = corners ?? "none";
  const accessibleName = resolveAccessibleName({
    ariaLabel,
    ariaLabelledBy,
    titleId,
    hasRenderableTitle,
  });

  const fallbackAriaLabel = accessibleName["aria-label"];
  const isFallbackName = fallbackAriaLabel === FALLBACK_DIALOG_LABEL;

  useEffect(() => {
    if (process.env.NODE_ENV === "production" || !open || !isFallbackName) return;
    // Defer to the next frame so a Title registered by a wrapper component (its
    // registration runs in a layout effect, after this render's fallback was
    // computed) clears the fallback before we warn — avoiding a false warning.
    const view = shellRef.current?.ownerDocument.defaultView ?? globalThis;
    const frame = view.requestAnimationFrame(() => {
      if (fallbackAriaLabel === FALLBACK_DIALOG_LABEL) {
        console.warn(
          "Dialog: No accessible name provided. Add a <Dialog.Title>, aria-label, or aria-labelledby prop.",
        );
      }
    });
    return () => view.cancelAnimationFrame(frame);
  }, [fallbackAriaLabel, isFallbackName, open]);

  const resolvedDescribedBy = mergeIds(
    ariaDescribedBy,
    hasRenderableDescription ? descriptionId : undefined,
  );

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
      initialFocus={initialFocus}
      onBackdropClick={closeOnBackdropClick ? close : undefined}
      onCancel={(e) => {
        onCancel?.(e);
        if (e.defaultPrevented) return;
        onEscapeKeyDown?.(e);
        if (!e.defaultPrevented) close();
      }}
      onBeforeShowModal={focusRestore.capture}
      onExitComplete={handleClose}
      onAnimationEnd={onAnimationEnd}
      className={cn(dialogContentVariants({ size, frame }), className)}
      data-slot="dialog-content"
      data-frame={resolvedFrame}
      data-corners={resolvedCorners}
      aria-modal="true"
      aria-label={accessibleName["aria-label"]}
      aria-labelledby={accessibleName["aria-labelledby"]}
      aria-description={ariaDescription}
      aria-describedby={resolvedDescribedBy}
    >
      <PortalContainerProvider container={container}>
        {resolvedCorners !== "none" ? <span aria-hidden="true" className="dlg-corners" /> : null}
        {children}
      </PortalContainerProvider>
    </DialogShell>
  );
}

function containsDialogTitleElement(children: ReactNode): boolean {
  return Children.toArray(children).some((child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return false;
    if (child.type === DialogRoot) return false;
    if (child.type === DialogTitle) return true;
    return containsDialogTitleElement(child.props.children);
  });
}

function containsDialogDescriptionElement(children: ReactNode): boolean {
  return Children.toArray(children).some((child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return false;
    if (child.type === DialogRoot) return false;
    if (child.type === DialogDescription) return true;
    return containsDialogDescriptionElement(child.props.children);
  });
}
