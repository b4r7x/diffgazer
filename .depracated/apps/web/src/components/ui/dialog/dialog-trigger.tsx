'use client';

import * as React from 'react';
import { useDialogContext, createClickHandler } from './dialog-context';

export interface DialogTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  asChild?: boolean;
}

export function DialogTrigger({ children, asChild, ...props }: DialogTriggerProps) {
  const { onOpenChange } = useDialogContext();
  const handleClick = createClickHandler(() => onOpenChange(true), props.onClick);

  if (asChild && React.isValidElement(children)) {
    const childElement = children as React.ReactElement<{ onClick?: React.MouseEventHandler<HTMLElement> }>;
    return React.cloneElement(childElement, {
      ...props,
      onClick: createClickHandler(() => onOpenChange(true), childElement.props.onClick),
    } as React.HTMLAttributes<HTMLElement>);
  }

  return (
    <button {...props} onClick={handleClick}>
      {children}
    </button>
  );
}
