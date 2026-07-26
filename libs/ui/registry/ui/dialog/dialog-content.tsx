"use client";

import { cva, type VariantProps } from "class-variance-authority";
import {
  Children,
  type ComponentProps,
  type ElementType,
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
import { useScrollLock } from "@/hooks/use-scroll-lock";
import { mergeIds } from "@/lib/aria";
import { cn } from "@/lib/utils";
import { DialogShell } from "../shared/dialog-shell";
import { OVERLAY_SURFACE_MODAL } from "../shared/overlay-surface";
import { PortalContainerProvider } from "../shared/portal-context";
import { Dialog as DialogRoot } from "./dialog";
import { useDialogContext } from "./dialog-context";
import { DialogDescription } from "./dialog-description";
import { DialogTitle } from "./dialog-title";

export type DialogCorners = "none" | "subtle" | "standard" | "bold" | "outset";

/** Class variants for dialog content. */
export const dialogContentVariants = cva(
  // Modal overlay tier: the shared --surface-1 step and lip plus --shadow-hard,
  // the library's only sanctioned drop shadow. The surface step is what makes
  // the panel read as raised when the offset shadow is clipped by a narrow
  // viewport; the `frame` variant below owns the hairline.
  cn(
    OVERLAY_SURFACE_MODAL,
    "relative w-full max-h-[90dvh] flex flex-col text-foreground m-auto",
    // Narrow viewports: inset from the edge so both vertical hairlines, the
    // offset shadow, and the corner brackets stay on-screen instead of being
    // clipped by the viewport. At >=640px nothing changes.
    "max-sm:mx-3 max-sm:w-[calc(100%-1.5rem)] max-sm:max-w-none",
    // Keep the footer's action row clear of the home indicator. Resolves to 0
    // when the host page ships no viewport-fit=cover.
    "max-sm:pb-[env(safe-area-inset-bottom)]",
  ),
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
    Omit<ComponentProps<"dialog">, "children" | "className" | "open"> {
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
   * should not close on outside interaction. Modal mode only — an inline dialog is a labelled
   * region, not a dialog (see `modal`).
   */
  role?: "dialog" | "alertdialog";
  /**
   * Renders the dialog as a native modal in the browser top layer (default). Pass false to
   * render the same frame, corners, and chrome in the document flow instead — no backdrop,
   * focus trap, scroll lock, or focus restoration, and no dialog role, since nothing is
   * modal about it. Use it to embed dialog chrome in a page, or to make the open state
   * reviewable on a static documentation page. Inline dialogs still honour `open`, so they
   * unmount when the consumer closes them.
   */
  modal?: boolean;
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

function hasNonEmptyText(value: string | undefined): boolean {
  return value !== undefined && value.trim().length > 0;
}

function resolveAccessibleName({
  ariaLabel,
  ariaLabelledBy,
  titleId,
  hasRenderableTitle,
}: {
  ariaLabel: string | undefined;
  ariaLabelledBy: string | undefined;
  titleId: string;
  hasRenderableTitle: boolean;
}): { "aria-label": string | undefined; "aria-labelledby": string | undefined } {
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
  modal = true,
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
  const scrollLockTargetRef = useRef<HTMLElement>(null);
  const [container, setContainer] = useState<Element | null>(null);
  const focusRestore = useFocusRestore({ restoreOnUnmount: true });
  useScrollLock({ target: scrollLockTargetRef, enabled: open && modal });
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
  const hasRenderableTitle = hasRegisteredTitle || containsDialogPart(children, DialogTitle);
  const hasRenderableDescription =
    hasRegisteredDescription || containsDialogPart(children, DialogDescription);
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
      console.warn(
        "Dialog: No accessible name provided. Add a <Dialog.Title>, aria-label, or aria-labelledby prop.",
      );
    });
    return () => view.cancelAnimationFrame(frame);
  }, [isFallbackName, open]);

  const resolvedDescribedBy = mergeIds(
    ariaDescribedBy,
    hasRenderableDescription ? descriptionId : undefined,
  );

  const setShellRef = useCallback((node: HTMLDialogElement | null) => {
    shellRef.current = node;
    scrollLockTargetRef.current = node?.ownerDocument.body ?? null;
    setContainer(node);
  }, []);

  const inner = (
    <PortalContainerProvider container={container}>
      {resolvedCorners !== "none" ? <span aria-hidden="true" className="dlg-corners" /> : null}
      {children}
    </PortalContainerProvider>
  );

  if (!modal) {
    if (!open) return null;
    return (
      // biome-ignore lint/a11y/useSemanticElements: an inline dialog is not modal, so role="dialog" would misannounce it; this is a labelled region wrapping the same chrome.
      <div
        // The rest props are typed against <dialog> because the modal path renders
        // one. Attribute names and payloads are identical here — only the event
        // target element type differs, which the cast re-points to the inline div.
        {...(rest as ComponentProps<"div">)}
        onAnimationEnd={onAnimationEnd as ComponentProps<"div">["onAnimationEnd"]}
        // Inline mode has no dialog element; the shell itself is the portal container.
        ref={setContainer}
        id={contentId}
        role="group"
        className={cn(dialogContentVariants({ size, frame }), className)}
        data-slot="dialog-content"
        data-frame={resolvedFrame}
        data-corners={resolvedCorners}
        data-state="open"
        aria-label={accessibleName["aria-label"]}
        aria-labelledby={accessibleName["aria-labelledby"]}
        aria-description={ariaDescription}
        aria-describedby={resolvedDescribedBy}
      >
        {inner}
      </div>
    );
  }

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
      {inner}
    </DialogShell>
  );
}

function containsDialogPart(children: ReactNode, part: ElementType): boolean {
  return Children.toArray(children).some((child) => {
    if (!isValidElement<{ children?: ReactNode }>(child)) return false;
    if (child.type === DialogRoot) return false;
    if (child.type === part) return true;
    return containsDialogPart(child.props.children, part);
  });
}
