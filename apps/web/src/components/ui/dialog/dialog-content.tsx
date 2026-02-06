import * as React from 'react';
import { cn } from '@/utils/cn';
import { useDialogContext } from './dialog-context';

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

function useFocusTrap(containerRef: React.RefObject<HTMLDivElement | null>) {
  React.useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, []);

  React.useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const container = containerRef.current;
    if (!container) return;

    // Auto-focus first focusable element
    const focusables = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    if (focusables.length > 0) {
      focusables[0].focus();
    } else {
      container.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusableEls = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusableEls.length === 0) return;

      const first = focusableEls[0];
      const last = focusableEls[focusableEls.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    container.addEventListener('keydown', handleKeyDown);
    return () => {
      container.removeEventListener('keydown', handleKeyDown);
      previousFocus?.focus();
    };
  }, []);
}

export interface DialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

function DialogContentInner({
  children,
  className,
  onClose,
  titleId,
  descriptionId,
  ...props
}: DialogContentProps & { onClose: () => void; titleId: string; descriptionId: string }) {
  const contentRef = React.useRef<HTMLDivElement>(null);
  useFocusTrap(contentRef);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-12">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={contentRef}
        className={cn(
          'relative w-full max-w-2xl max-h-[90vh] flex flex-col',
          'bg-tui-bg text-tui-fg',
          'border-[6px] border-double border-tui-fg',
          'shadow-[0_0_0_1px_rgb(48_54_61),0_30px_60px_-12px_rgba(0,0,0,0.9)]',
          className
        )}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        {...props}
      >
        {children}
      </div>
    </div>
  );
}

export function DialogContent({ children, className, ...props }: DialogContentProps) {
  const { open, onOpenChange, titleId, descriptionId } = useDialogContext();
  const handleClose = () => onOpenChange(false);

  if (!open) return null;

  return (
    <DialogContentInner
      className={className}
      onClose={handleClose}
      titleId={titleId}
      descriptionId={descriptionId}
      {...props}
    >
      {children}
    </DialogContentInner>
  );
}
