"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type AnimationEvent,
  type ReactNode,
  type HTMLAttributes,
  type KeyboardEvent,
  type MouseEvent,
  type SyntheticEvent,
  type Ref,
} from "react";
import { usePresence } from "@/hooks/use-presence";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useScrollLock } from "@/hooks/use-scroll-lock";
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
}

// iOS Safari < 15.4 does not implement <dialog>.showModal(). Detect once per
// load; the polyfill in test-setup keeps existing tests on the native path.
function detectShowModalSupport(): boolean {
  if (typeof HTMLDialogElement === "undefined") return false;
  return "showModal" in HTMLDialogElement.prototype;
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
  onClick,
  onAnimationEnd: externalOnAnimationEnd,
  ...props
}: DialogShellProps) {
  const shellRef = useRef<HTMLElement | null>(null);
  const supportsShowModal = detectShowModalSupport();
  // usePresence's native animationend/animationcancel listener owns the
  // exit-complete path; do not also wire the returned React handler here or
  // onClose would fire twice on the non-portaled <dialog>.
  const { present } = usePresence({
    open,
    ref: shellRef,
    onExitComplete: () => {
      const element = shellRef.current;
      if (supportsShowModal && element instanceof HTMLDialogElement && element.open) {
        element.close();
      }
      onClose?.();
    },
  });

  // Fallback path uses the same hooks every render; the `enabled` flag scopes
  // them to non-native dialogs that are present.
  const fallbackActive = !supportsShowModal && open && present;
  useFocusTrap(shellRef, { enabled: fallbackActive, restoreFocus: false });
  useScrollLock({ enabled: fallbackActive });

  useLayoutEffect(() => {
    if (!supportsShowModal) return;
    const element = shellRef.current;
    if (!(element instanceof HTMLDialogElement)) return;
    if (open && present && !element.open) {
      onBeforeShowModal?.(element.ownerDocument);
      element.showModal();
      onAfterShowModal?.();
    }
  }, [onAfterShowModal, onBeforeShowModal, open, present, supportsShowModal]);

  useLayoutEffect(() => {
    if (supportsShowModal) return;
    const element = shellRef.current;
    if (!open || !present || !element) return;
    onBeforeShowModal?.(element.ownerDocument);
    onAfterShowModal?.();
  }, [onAfterShowModal, onBeforeShowModal, open, present, supportsShowModal]);

  useEffect(() => {
    if (!fallbackActive) return;
    const element = shellRef.current;
    if (!element) return;
    // Native <dialog> showModal() makes the rest of the document inert. Emulate
    // by walking from the dialog up to <body>, inerting the siblings at each
    // level so every element that is NOT an ancestor of the dialog becomes
    // inert without inerting the dialog itself.
    const body = element.ownerDocument.body;
    const inerted: Element[] = [];
    let cursor: Element | null = element;
    while (cursor && cursor !== body && cursor.parentElement) {
      for (const sibling of Array.from(cursor.parentElement.children)) {
        if (sibling === cursor) continue;
        if (sibling.hasAttribute("inert")) continue;
        sibling.setAttribute("inert", "");
        inerted.push(sibling);
      }
      cursor = cursor.parentElement;
    }
    return () => {
      for (const sibling of inerted) sibling.removeAttribute("inert");
    };
  }, [fallbackActive]);

  const handleFallbackOutsidePointerDown = useCallback((event: globalThis.PointerEvent) => {
    if (!(event.target instanceof Node)) return;
    const element = shellRef.current;
    if (!element || element.contains(event.target)) return;
    // onBackdropClick's signature expects a React synthetic event, but all
    // current consumers (dialog-content, command-palette-content) discard the
    // argument. Pass a structurally-compatible stand-in to keep the public
    // API unchanged.
    onBackdropClick?.(event as unknown as MouseEvent<HTMLDialogElement>);
  }, [onBackdropClick]);

  useEffect(() => {
    if (!fallbackActive) return;
    const element = shellRef.current;
    if (!element) return;
    const doc = element.ownerDocument;
    doc.addEventListener("pointerdown", handleFallbackOutsidePointerDown, { capture: true });
    return () => doc.removeEventListener("pointerdown", handleFallbackOutsidePointerDown, { capture: true });
  }, [fallbackActive, handleFallbackOutsidePointerDown]);

  if (!present) return null;

  const setShellRef = (node: HTMLElement | null) => {
    shellRef.current = node;
  };

  if (supportsShowModal) {
    const dialogRef: Ref<HTMLDialogElement> = externalDialogRef
      ? composeRefs(setShellRef, externalDialogRef)
      : setShellRef;
    return (
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

  // Fallback path renders a <div role="dialog"> instead of <dialog>; bridge
  // typed handlers through the shared SyntheticEvent supertype because the
  // public DialogShell API is typed for HTMLDialogElement.
  const handleFallbackKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Escape") return;
    onCancel?.(e as unknown as SyntheticEvent<HTMLDialogElement>);
    if (e.defaultPrevented) return;
    e.preventDefault();
  };

  return (
    <div
      {...(props as HTMLAttributes<HTMLDivElement>)}
      ref={composeRefs(setShellRef, externalDialogRef as unknown as Ref<HTMLDivElement> | undefined)}
      role="dialog"
      tabIndex={-1}
      data-state={open ? "open" : "closed"}
      className={className}
      onClick={onClick as unknown as ((e: MouseEvent<HTMLDivElement>) => void) | undefined}
      onKeyDown={handleFallbackKeyDown}
      onAnimationEnd={externalOnAnimationEnd as unknown as ((e: AnimationEvent<HTMLDivElement>) => void) | undefined}
    >
      {children}
    </div>
  );
}
