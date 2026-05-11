"use client";

import {
  useRef,
  useLayoutEffect,
  type ReactNode,
  type HTMLAttributes,
  type MouseEvent,
  type SyntheticEvent,
  type Ref,
} from "react";
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
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { present, onAnimationEnd } = usePresence({
    open,
    ref: dialogRef,
    onExitComplete: () => {
      dialogRef.current?.close();
      onClose?.();
    },
  });

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (open && present && dialog && !dialog.open) {
      onBeforeShowModal?.(dialog.ownerDocument);
      dialog.showModal();
      onAfterShowModal?.();
    }
  }, [onAfterShowModal, onBeforeShowModal, open, present]);

  if (!present) return null;

  return (
    <dialog
      {...props}
      ref={externalDialogRef ? composeRefs(dialogRef, externalDialogRef) : dialogRef}
      data-state={open ? "open" : "closed"}
      className={className}
      onClick={(e: MouseEvent<HTMLDialogElement>) => {
        onClick?.(e);
        const dialog = dialogRef.current;
        if (dialog && e.target === dialog && isClickOutsideDialogRect(e, dialog)) {
          onBackdropClick?.(e);
        }
      }}
      onCancel={(e) => {
        onCancel?.(e);
        e.preventDefault();
      }}
      onAnimationEnd={(e) => {
        externalOnAnimationEnd?.(e);
        onAnimationEnd(e);
      }}
    >
      {children}
    </dialog>
  );
}
