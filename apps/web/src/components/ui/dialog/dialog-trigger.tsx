import type { ReactNode, MouseEventHandler } from 'react';
import { useDialogContext } from './dialog-context';

export interface DialogTriggerProps {
  children: ReactNode;
  className?: string;
  onClick?: MouseEventHandler<HTMLButtonElement>;
}

export function DialogTrigger({ children, className, onClick }: DialogTriggerProps) {
  const { onOpenChange } = useDialogContext();

  return (
    <button
      className={className}
      onClick={(e) => {
        onOpenChange(true);
        onClick?.(e);
      }}
    >
      {children}
    </button>
  );
}
