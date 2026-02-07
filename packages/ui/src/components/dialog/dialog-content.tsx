import { useRef, useEffect, type HTMLAttributes, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";
import { Portal } from "../../internal/portal";
import { useDialogContext } from "./dialog-context";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useFocusTrap(containerRef: RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    if (!container) return;

    const focusables = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    const firstFocusable = focusables[0];
    if (firstFocusable) {
      firstFocusable.focus();
    } else {
      container.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusableEls = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusableEls.length === 0) return;

      const first = focusableEls[0];
      const last = focusableEls[focusableEls.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    container.addEventListener("keydown", handleKeyDown);
    return () => {
      container.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, []);
}

const dialogContentVariants = cva(
  "relative w-full max-h-[90vh] flex flex-col bg-tui-bg text-tui-fg border-[6px] border-double border-tui-fg shadow-[0_0_0_1px_rgb(48_54_61),0_30px_60px_-12px_rgba(0,0,0,0.9)]",
  {
    variants: {
      size: {
        sm: "max-w-sm",
        md: "max-w-2xl",
        lg: "max-w-4xl",
        full: "max-w-full",
      },
    },
    defaultVariants: {
      size: "md",
    },
  }
);

export interface DialogContentProps
  extends HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof dialogContentVariants> {
  children: ReactNode;
}

function DialogContentInner({
  children,
  className,
  size,
  onClose,
  titleId,
  descriptionId,
  ...props
}: DialogContentProps & { onClose: () => void; titleId: string; descriptionId: string }) {
  const contentRef = useRef<HTMLDivElement>(null);
  useFocusTrap(contentRef);

  const handleKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === "Escape") {
      event.stopPropagation();
      onClose();
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-12">
        <DialogOverlay onClick={onClose} />
        <div
          ref={contentRef}
          className={cn(dialogContentVariants({ size }), className)}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          data-state="open"
          onKeyDown={handleKeyDown}
          {...props}
        >
          {children}
        </div>
      </div>
    </Portal>
  );
}

export function DialogOverlay({ onClick }: { onClick?: () => void }) {
  return (
    <div
      className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      onClick={onClick}
      aria-hidden="true"
    />
  );
}

export function DialogContent({ children, className, size, ...props }: DialogContentProps) {
  const { open, onOpenChange, titleId, descriptionId } = useDialogContext();
  const handleClose = () => onOpenChange(false);

  if (!open) return null;

  return (
    <DialogContentInner
      className={className}
      size={size}
      onClose={handleClose}
      titleId={titleId}
      descriptionId={descriptionId}
      {...props}
    >
      {children}
    </DialogContentInner>
  );
}
