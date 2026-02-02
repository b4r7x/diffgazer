'use client';

import * as React from 'react';
import { useDialogContext, createClickHandler } from './dialog-context';

export interface DialogCloseProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  asChild?: boolean;
}

export function DialogClose({ children, asChild, ...props }: DialogCloseProps) {
  const { onOpenChange } = useDialogContext();
  const handleClick = createClickHandler(() => onOpenChange(false), props.onClick);

  if (asChild && React.isValidElement(children)) {
    const childElement = children as React.ReactElement<{ onClick?: React.MouseEventHandler<HTMLElement> }>;
    return React.cloneElement(childElement, {
      ...props,
      onClick: createClickHandler(() => onOpenChange(false), childElement.props.onClick),
    } as React.HTMLAttributes<HTMLElement>);
  }

  return (
    <button {...props} onClick={handleClick}>
      {children || '[x]'}
    </button>
  );
}
