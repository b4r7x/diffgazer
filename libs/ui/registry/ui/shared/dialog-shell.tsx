"use client";

import {
  type ComponentProps,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type Ref,
  type RefObject,
  type SyntheticEvent,
  useCallback,
  useLayoutEffect,
  useRef,
} from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { usePresence } from "@/hooks/use-presence";
import { isHTMLDialogElement } from "@/lib/aria";
import { createTopLayerStack, useTopLayerPosition } from "@/lib/top-layer-stack";

/** Props for dialog shell. */
export interface DialogShellProps extends ComponentProps<"dialog"> {
  /** Controlled open state. */
  open: boolean;
  /** Called when backdrop click occurs. */
  onBackdropClick?: (e: MouseEvent<HTMLDialogElement>) => void;
  /** Called when cancel occurs. */
  onCancel?: (e: SyntheticEvent<HTMLDialogElement>) => void;
  /** Called when before show modal occurs. */
  onBeforeShowModal?: (ownerDocument: Document) => void;
  /** Called when after show modal occurs. */
  onAfterShowModal?: () => void;
  /** Called after the exit transition has closed the native dialog. */
  onExitComplete?: () => void;
  /** Content rendered inside the component. */
  children: ReactNode;
  /** Ref for the dialog element. */
  dialogRef?: Ref<HTMLDialogElement>;
  /** Element that receives focus when the overlay opens. */
  initialFocus?: RefObject<HTMLElement | null>;
}

const dialogShellStack = createTopLayerStack();

function isEventOutsideDialogRect(
  event: { clientX: number; clientY: number },
  dialog: HTMLDialogElement,
): boolean {
  const rect = dialog.getBoundingClientRect();
  return (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  );
}

/** Renders the dialog shell component. */
export function DialogShell({
  open,
  onBackdropClick,
  onCancel,
  onBeforeShowModal,
  onAfterShowModal,
  onExitComplete,
  children,
  className,
  dialogRef: externalDialogRef,
  initialFocus,
  onClick,
  onClickCapture,
  onPointerDown,
  onAnimationEnd: externalOnAnimationEnd,
  ...props
}: DialogShellProps) {
  const shellRef = useRef<HTMLElement | null>(null);
  const didPressBackdropRef = useRef(false);
  const isClosingFromShellRef = useRef(false);
  // usePresence's native animationend/animationcancel listener owns the
  // exit-complete path; do not also wire the returned React handler here or
  // onExitComplete would fire twice on the non-portaled <dialog>.
  const { present } = usePresence({
    open,
    ref: shellRef,
    onExitComplete: () => {
      const element = shellRef.current;
      if (isHTMLDialogElement(element) && element.open) {
        isClosingFromShellRef.current = true;
        try {
          element.close();
        } finally {
          isClosingFromShellRef.current = false;
        }
      }
      onExitComplete?.();
    },
  });

  // DialogContent owns focus restoration via useFocusRestore, so this trap is
  // configured with restoreFocus: false.
  const trapActive = open && present;

  const isTopShell = useTopLayerPosition(dialogShellStack, shellRef, trapActive);

  useFocusTrap(shellRef, { enabled: trapActive && isTopShell, restoreFocus: false, initialFocus });

  useLayoutEffect(() => {
    const element = shellRef.current;
    if (!isHTMLDialogElement(element)) return;
    if (open && present && !element.open) {
      onBeforeShowModal?.(element.ownerDocument);
      element.showModal();
      onAfterShowModal?.();
    }
  }, [onAfterShowModal, onBeforeShowModal, open, present]);

  useLayoutEffect(() => {
    const element = shellRef.current;
    if (!isHTMLDialogElement(element)) return;

    const handleNativeClose = () => {
      if (isClosingFromShellRef.current || !open || !present || element.open) return;
      onBeforeShowModal?.(element.ownerDocument);
      element.showModal();
      onAfterShowModal?.();
    };

    element.addEventListener("close", handleNativeClose);
    return () => element.removeEventListener("close", handleNativeClose);
  }, [onAfterShowModal, onBeforeShowModal, open, present]);

  const setShellRef = useCallback((node: HTMLElement | null) => {
    shellRef.current = node;
  }, []);
  const dialogRef: Ref<HTMLDialogElement> = useComposedRefs(
    setShellRef as Ref<HTMLElement>,
    externalDialogRef,
  );

  if (!present) return null;

  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: this onClick only detects backdrop (outside-rect) clicks to dismiss; keyboard dismissal is handled by the dialog's Escape behavior, so there is no keyboard equivalent for a backdrop click.
    <dialog
      {...props}
      ref={dialogRef}
      data-state={open ? "open" : "closed"}
      inert={open ? undefined : true}
      className={className}
      onClickCapture={(e) => {
        if (!open) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        onClickCapture?.(e);
      }}
      onPointerDown={(e: PointerEvent<HTMLDialogElement>) => {
        onPointerDown?.(e);
        const element = shellRef.current;
        didPressBackdropRef.current =
          isHTMLDialogElement(element) &&
          e.target === element &&
          isEventOutsideDialogRect(e, element);
      }}
      onClick={(e: MouseEvent<HTMLDialogElement>) => {
        onClick?.(e);
        const element = shellRef.current;
        if (
          isHTMLDialogElement(element) &&
          didPressBackdropRef.current &&
          e.target === element &&
          isEventOutsideDialogRect(e, element)
        ) {
          onBackdropClick?.(e);
        }
        didPressBackdropRef.current = false;
      }}
      onCancel={(e) => {
        onCancel?.(e);
        e.preventDefault();
      }}
      onAnimationEnd={externalOnAnimationEnd}
    >
      {children}
    </dialog>
  );
}
