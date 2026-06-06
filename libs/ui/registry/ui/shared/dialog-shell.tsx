"use client";

import {
  type HTMLAttributes,
  type MouseEvent,
  type ReactNode,
  type Ref,
  type RefObject,
  type SyntheticEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { usePresence } from "@/hooks/use-presence";
import { composeRefs } from "@/lib/compose-refs";

export interface DialogShellProps
  extends HTMLAttributes<HTMLDialogElement> {
  open: boolean;
  onBackdropClick?: (e: MouseEvent<HTMLDialogElement>) => void;
  onCancel?: (e: SyntheticEvent<HTMLDialogElement>) => void;
  onBeforeShowModal?: (ownerDocument: Document) => void;
  onAfterShowModal?: () => void;
  onClose?: () => void;
  children: ReactNode;
  dialogRef?: Ref<HTMLDialogElement>;
  initialFocus?: RefObject<HTMLElement | null>;
}

// Module-level stack of currently mounted, open DialogShell elements. Only the
// topmost shell runs its focus trap so peer/stacked dialogs do not fight over
// focus via competing focusin listeners on ownerDocument. Subscribers are
// notified after every push/pop with the new top element; each shell updates
// its local isTopShell state in response.
const openShellStack: HTMLElement[] = [];
const shellStackSubscribers = new Set<(top: HTMLElement | null) => void>();

function notifyShellStack(): void {
  const top = openShellStack.at(-1) ?? null;
  for (const cb of shellStackSubscribers) cb(top);
}

function pushShell(element: HTMLElement): void {
  openShellStack.push(element);
  notifyShellStack();
}

function popShell(element: HTMLElement): void {
  const index = openShellStack.lastIndexOf(element);
  if (index >= 0) openShellStack.splice(index, 1);
  notifyShellStack();
}

function isClickOutsideDialogRect(event: MouseEvent<HTMLDialogElement>, dialog: HTMLDialogElement): boolean {
  const rect = dialog.getBoundingClientRect();
  return (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  );
}

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
  onAnimationEnd: externalOnAnimationEnd,
  ...props
}: DialogShellProps) {
  const shellRef = useRef<HTMLElement | null>(null);
  // usePresence's native animationend/animationcancel listener owns the
  // exit-complete path; do not also wire the returned React handler here or
  // onClose would fire twice on the non-portaled <dialog>.
  const { present } = usePresence({
    open,
    ref: shellRef,
    onExitComplete: () => {
      const element = shellRef.current;
      if (element instanceof HTMLDialogElement && element.open) {
        element.close();
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
    const updateTop = (top: HTMLElement | null) => setIsTopShell(top === element);
    shellStackSubscribers.add(updateTop);
    pushShell(element);
    return () => {
      shellStackSubscribers.delete(updateTop);
      popShell(element);
      setIsTopShell(false);
    };
  }, [trapActive]);

  useFocusTrap(shellRef, { enabled: trapActive && isTopShell, restoreFocus: false, initialFocus });

  useLayoutEffect(() => {
    const element = shellRef.current;
    if (!(element instanceof HTMLDialogElement)) return;
    if (open && present && !element.open) {
      onBeforeShowModal?.(element.ownerDocument);
      element.showModal();
      onAfterShowModal?.();
    }
  }, [onAfterShowModal, onBeforeShowModal, open, present]);

  if (!present) return null;

  const setShellRef = (node: HTMLElement | null) => {
    shellRef.current = node;
  };

  const dialogRef: Ref<HTMLDialogElement> = externalDialogRef
    ? composeRefs(setShellRef, externalDialogRef)
    : setShellRef;
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: this onClick only detects backdrop (outside-rect) clicks to dismiss; keyboard dismissal is handled by the dialog's Escape behavior, so there is no keyboard equivalent for a backdrop click.
    <dialog
      {...props}
      ref={dialogRef}
      data-state={open ? "open" : "closed"}
      className={className}
      onClick={(e: MouseEvent<HTMLDialogElement>) => {
        onClick?.(e);
        const element = shellRef.current;
        if (element instanceof HTMLDialogElement && e.target === element && isClickOutsideDialogRect(e, element)) {
          onBackdropClick?.(e);
        }
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
