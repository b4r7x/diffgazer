import { useState, useId, type ReactNode } from "react";
import { DialogContext, type DialogContextValue } from "./dialog-context";

export interface DialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

export function Dialog({ open: controlledOpen, onOpenChange, children }: DialogProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isOpen = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;
  const handleOpenChange = (open: boolean) => {
    if (onOpenChange) onOpenChange(open);
    else setUncontrolledOpen(open);
  };
  const dialogId = useId();

  const contextValue: DialogContextValue = {
    open: isOpen,
    onOpenChange: handleOpenChange,
    titleId: `${dialogId}-title`,
    descriptionId: `${dialogId}-description`,
  };

  return (
    <DialogContext.Provider value={contextValue}>
      {children}
    </DialogContext.Provider>
  );
}
