import { useFocusTrap, useScrollLock } from "@diffgazer/keys";
import { type ReactNode, type RefObject, useId, useRef } from "react";

interface DemoDialogProps {
  title: string;
  initialFocus: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
}

export function DemoDialog({ title, initialFocus, onClose, children }: DemoDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useFocusTrap(dialogRef, { initialFocus });
  useScrollLock();

  return (
    <div
      ref={dialogRef}
      className="demo-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
    >
      <button
        type="button"
        className="demo-overlay-backdrop"
        aria-label={`Close ${title}`}
        tabIndex={-1}
        onClick={onClose}
      />
      <div className="demo-dialog">
        <h3 id={titleId} style={{ marginBottom: 16 }}>
          {title}
        </h3>
        {children}
      </div>
    </div>
  );
}
