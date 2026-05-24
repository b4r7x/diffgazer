"use client";

import { Dialog as DialogRoot, type DialogProps } from "./dialog";
import { DialogTrigger, type DialogTriggerProps, type DialogTriggerRenderProps } from "./dialog-trigger";
import { DialogContent, dialogContentVariants, type DialogContentProps, type DialogCorners } from "./dialog-content";
import { DialogHeader, type DialogHeaderProps } from "./dialog-header";
import { DialogTitle, type DialogTitleProps } from "./dialog-title";
import { DialogDescription, type DialogDescriptionProps } from "./dialog-description";
import { DialogBody, type DialogBodyProps } from "./dialog-body";
import { DialogFooter, type DialogFooterProps } from "./dialog-footer";
import { type DialogKeyboardHintsProps, type KeyboardHint } from "./dialog-keyboard-hints";
import { DialogClose, type DialogCloseProps } from "./dialog-close";
import { DialogCloseIcon, type DialogCloseIconProps } from "./dialog-close-icon";
import { DialogAction, type DialogActionProps } from "./dialog-action";

const Dialog = Object.assign(DialogRoot, {
  Trigger: DialogTrigger,
  Content: DialogContent,
  Header: DialogHeader,
  Title: DialogTitle,
  Description: DialogDescription,
  Body: DialogBody,
  Footer: DialogFooter,
  Close: DialogClose,
  CloseIcon: DialogCloseIcon,
  Action: DialogAction,
});

export { Dialog, type DialogProps };
export { DialogTrigger, type DialogTriggerProps, type DialogTriggerRenderProps };
export { DialogContent, dialogContentVariants, type DialogContentProps, type DialogCorners };
export { DialogHeader, type DialogHeaderProps };
export { DialogTitle, type DialogTitleProps };
export { DialogDescription, type DialogDescriptionProps };
export { DialogBody, type DialogBodyProps };
export { DialogFooter, type DialogFooterProps };
export { DialogClose, type DialogCloseProps };
export { DialogCloseIcon, type DialogCloseIconProps };
export { DialogAction, type DialogActionProps };
export { type DialogKeyboardHintsProps, type KeyboardHint };
