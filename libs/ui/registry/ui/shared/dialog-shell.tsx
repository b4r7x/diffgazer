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
import "./dialog.css";

export interface DialogShellProps
  extends Omit<HTMLAttributes<HTMLDialogElement>, "onClick"> {
  open: boolean;
  onBackdropClick?: (e: MouseEvent<HTMLDialogElement>) => void;
  onCancel?: (e: SyntheticEvent<HTMLDialogElement>) => void;
  onClose?: () => void;
  children: ReactNode;
  dialogRef?: Ref<HTMLDialogElement>;
}

export function DialogShell({
  open,
  onBackdropClick,
  onCancel,
  onClose,
  children,
  className,
  dialogRef: externalDialogRef,
  ...props
}: DialogShellProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const { present, onAnimationEnd } = usePresence({ open, ref: dialogRef });

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, [present]);

  if (!present) return null;

  return (
    <dialog
      ref={externalDialogRef ? composeRefs(dialogRef, externalDialogRef) : dialogRef}
      data-state={open ? "open" : "closed"}
      className={className}
      onClick={(e: MouseEvent<HTMLDialogElement>) => {
        if (e.target === dialogRef.current) onBackdropClick?.(e);
      }}
      onCancel={(e) => {
        onCancel?.(e);
        e.preventDefault();
      }}
      onAnimationEnd={(e) => {
        if (e.target === dialogRef.current && !open) {
          dialogRef.current?.close();
          onClose?.();
        }
        onAnimationEnd(e);
      }}
      {...props}
    >
      {children}
    </dialog>
  );
}
