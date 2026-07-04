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
  useState,
} from "react";
import { useComposedRefs } from "@/hooks/use-composed-refs";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { usePresence } from "@/hooks/use-presence";
import { isHTMLDialogElement } from "@/lib/aria";

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
  /** Called when close occurs. */
  onClose?: () => void;
  /** Content rendered inside the component. */
  children: ReactNode;
  /** Ref for the dialog element. */
  dialogRef?: Ref<HTMLDialogElement>;
  /** Element that receives focus when the overlay opens. */
  initialFocus?: RefObject<HTMLElement | null>;
}

// Per-document stacks of currently mounted, open DialogShell elements. Only the
// topmost shell in each document runs its focus trap so peer/stacked dialogs do
// not fight over focus via competing focusin listeners on ownerDocument.
// Subscribers are notified after every push/pop with the new top element for
// their document; each shell updates its local isTopShell state in response.
const openShellStacks = new WeakMap<Document, HTMLElement[]>();

interface ShellStackSubscriber {
  ownerDocument: Document;
  onTopChange: (top: HTMLElement | null) => void;
}

const shellStackSubscribers = new Set<ShellStackSubscriber>();

function getOpenShellStack(ownerDocument: Document): HTMLElement[] {
  let stack = openShellStacks.get(ownerDocument);
  if (!stack) {
    stack = [];
    openShellStacks.set(ownerDocument, stack);
  }
  return stack;
}

function notifyShellStack(ownerDocument: Document): void {
  const top = getOpenShellStack(ownerDocument).at(-1) ?? null;
  for (const subscriber of shellStackSubscribers) {
    if (subscriber.ownerDocument === ownerDocument) {
      subscriber.onTopChange(top);
    }
  }
}

function pushShell(element: HTMLElement): void {
  const ownerDocument = element.ownerDocument;
  getOpenShellStack(ownerDocument).push(element);
  notifyShellStack(ownerDocument);
}

function popShell(element: HTMLElement): void {
  const ownerDocument = element.ownerDocument;
  const stack = getOpenShellStack(ownerDocument);
  const index = stack.lastIndexOf(element);
  if (index >= 0) stack.splice(index, 1);
  notifyShellStack(ownerDocument);
}

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
  onClose,
  children,
  className,
  dialogRef: externalDialogRef,
  initialFocus,
  onClick,
  onPointerDown,
  onAnimationEnd: externalOnAnimationEnd,
  ...props
}: DialogShellProps) {
  const shellRef = useRef<HTMLElement | null>(null);
  const didPressBackdropRef = useRef(false);
  const isClosingFromShellRef = useRef(false);
  // usePresence's native animationend/animationcancel listener owns the
  // exit-complete path; do not also wire the returned React handler here or
  // onClose would fire twice on the non-portaled <dialog>.
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
      onClose?.();
    },
  });

  // DialogContent owns focus restoration via useFocusRestore, so this trap is
  // configured with restoreFocus: false.
  const trapActive = open && present;

  // When dialogs stack (peer Dialog defaultOpen or programmatically opened
  // dialog-in-dialog), only the topmost shell's trap stays enabled. Outer
  // traps go dormant so their ownerDocument-level focusin listeners do not
  // fight the inner trap. isTopShell defaults to false so the first-render
  // useFocusTrap effect is a no-op; the layout effect then pushes onto the
  // stack and notifies all subscribers, and the resulting setState triggers a
  // follow-up render where exactly one shell activates its trap.
  const [isTopShell, setIsTopShell] = useState(false);
  useLayoutEffect(() => {
    if (!trapActive) return;
    const element = shellRef.current;
    if (!element) return;
    const ownerDocument = element.ownerDocument;
    const subscriber: ShellStackSubscriber = {
      ownerDocument,
      onTopChange: (top) => setIsTopShell(top === element),
    };
    shellStackSubscribers.add(subscriber);
    pushShell(element);
    return () => {
      shellStackSubscribers.delete(subscriber);
      popShell(element);
      setIsTopShell(false);
    };
  }, [trapActive]);

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
      className={className}
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
