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
import { DialogCloseIcon } from "./dialog-close-icon";
import { useDialogContext } from "./dialog-context";
import { DialogDescription } from "./dialog-description";
import { DialogTitle } from "./dialog-title";

export type DialogCorners = "none" | "subtle" | "standard" | "bold" | "outset";

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
      height: {
        auto: "",
        // Stable list-dialog height: the panel keeps one height regardless of
        // how much content it holds (loading, filtered, empty), so the frame
        // never jumps as a list resolves. The body's flex-1 region absorbs the
        // slack; the dvh term caps it on short viewports.
        stable: "h-[min(40rem,85dvh)]",
      },
    },
    defaultVariants: {
      size: "md",
      frame: "border",
      height: "auto",
    },
  },
);

const FALLBACK_DIALOG_LABEL = "Dialog";

interface DialogContentCommonProps extends VariantProps<typeof dialogContentVariants> {
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
}

interface DialogContentModalProps
  extends DialogContentCommonProps,
    Omit<ComponentProps<"dialog">, "children" | "className" | "open"> {
  /**
   * Renders the dialog as a native modal in the browser top layer (default). Pass false to
   * render the same frame, corners, and chrome in the document flow instead — no backdrop,
   * focus trap, scroll lock, or focus restoration, and no dialog role, since nothing is
   * modal about it. Use it to embed dialog chrome in a page, or to make the open state
   * reviewable on a static documentation page. Inline dialogs still honour `open`, so they
   * unmount when the consumer closes them.
   */
  modal?: true;
  /**
   * Set role="alertdialog" for destructive confirmations. Per WAI-ARIA APG, alert dialogs
   * should not close on outside interaction. Modal mode only — an inline dialog is a labelled
   * region, not a dialog (see `modal`).
   */
  role?: "dialog" | "alertdialog";
  /**
   * Renders the top-right [x] close control on a modal dialog (default). Pass false to opt out
   * when the dialog owns its own dismissal affordance. Inline dialogs never render it — nothing
   * is modal about them — so compose Dialog.CloseIcon explicitly there.
   */
  closeIcon?: boolean;
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

interface DialogContentInlineProps
  extends DialogContentCommonProps,
    Omit<ComponentProps<"div">, "children" | "className" | "open" | "role"> {
  modal: false;
  role?: never;
  closeIcon?: never;
  closeOnBackdropClick?: never;
  initialFocus?: never;
  onCancel?: never;
  onEscapeKeyDown?: never;
}

export type DialogContentProps = DialogContentModalProps | DialogContentInlineProps;

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
 * If none are present the dialog falls back to the accessible label "Dialog" so it still
 * opens with a usable name rather than an unnamed one.
 */
export function DialogContent(props: DialogContentProps) {
  const {
    children,
    className,
    size,
    frame,
    height,
    corners,
    "aria-label": ariaLabel,
    "aria-labelledby": ariaLabelledBy,
    "aria-description": ariaDescription,
    "aria-describedby": ariaDescribedBy,
  } = props;
  const modal = props.modal ?? true;
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

  const resolvedDescribedBy = mergeIds(
    ariaDescribedBy,
    hasRenderableDescription ? descriptionId : undefined,
  );

  const setShellRef = useCallback((node: HTMLDialogElement | null) => {
    shellRef.current = node;
    scrollLockTargetRef.current = node?.ownerDocument.body ?? null;
    setContainer(node);
  }, []);

  const showCloseIcon = props.modal !== false && (props.closeIcon ?? true);

  const inner = (
    <PortalContainerProvider container={container}>
      {resolvedCorners !== "none" ? <span aria-hidden="true" className="dlg-corners" /> : null}
      {children}
      {/* Last in DOM so the [x] is the final tab stop, not an interception before the content. */}
      {showCloseIcon ? <DialogCloseIcon /> : null}
    </PortalContainerProvider>
  );

  if (props.modal === false) {
    if (!open) return null;
    const {
      modal: _modal,
      children: _children,
      className: _className,
      size: _size,
      frame: _frame,
      height: _height,
      corners: _corners,
      role: _role,
      closeIcon: _closeIcon,
      closeOnBackdropClick: _closeOnBackdropClick,
      initialFocus: _initialFocus,
      onCancel: _onCancel,
      onEscapeKeyDown: _onEscapeKeyDown,
      onAnimationEnd: inlineOnAnimationEnd,
      "aria-label": _ariaLabel,
      "aria-labelledby": _ariaLabelledBy,
      "aria-description": _ariaDescription,
      "aria-describedby": _ariaDescribedBy,
      ...divRest
    } = props;
    return (
      // biome-ignore lint/a11y/useSemanticElements: an inline dialog is not modal, so role="dialog" would misannounce it; this is a labelled region wrapping the same chrome.
      <div
        {...divRest}
        onAnimationEnd={inlineOnAnimationEnd}
        // Inline mode has no dialog element; the shell itself is the portal container.
        ref={setContainer}
        id={contentId}
        role="group"
        className={cn(dialogContentVariants({ size, frame, height }), className)}
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

  const {
    modal: _modal,
    children: _children,
    className: _className,
    size: _size,
    frame: _frame,
    height: _height,
    corners: _corners,
    closeIcon = true,
    closeOnBackdropClick = true,
    initialFocus,
    onEscapeKeyDown,
    onCancel,
    onAnimationEnd: modalOnAnimationEnd,
    "aria-label": _ariaLabel,
    "aria-labelledby": _ariaLabelledBy,
    "aria-description": _ariaDescription,
    "aria-describedby": _ariaDescribedBy,
    ...dialogRest
  } = props;

  return (
    <DialogShell
      {...dialogRest}
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
      onAnimationEnd={modalOnAnimationEnd}
      className={cn(dialogContentVariants({ size, frame, height }), className)}
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
