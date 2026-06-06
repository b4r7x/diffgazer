"use client";

import { type DialogProps, Dialog as DialogRoot } from "./dialog";
import { DialogAction, type DialogActionProps } from "./dialog-action";
import { DialogBody, type DialogBodyProps } from "./dialog-body";
import { DialogClose, type DialogCloseProps } from "./dialog-close";
import { DialogCloseIcon, type DialogCloseIconProps } from "./dialog-close-icon";
import { DialogContent, type DialogContentProps, type DialogCorners, dialogContentVariants } from "./dialog-content";
import { DialogDescription, type DialogDescriptionProps } from "./dialog-description";
import { DialogFooter, type DialogFooterProps } from "./dialog-footer";
import { DialogHeader, type DialogHeaderProps } from "./dialog-header";
import { DialogKeyboardHints, type DialogKeyboardHintsProps, type KeyboardHint } from "./dialog-keyboard-hints";
import { DialogTitle, type DialogTitleProps } from "./dialog-title";
import { DialogTrigger, type DialogTriggerProps, type DialogTriggerRenderProps } from "./dialog-trigger";

const Dialog = Object.assign(DialogRoot, {
  Trigger: DialogTrigger,
  Content: DialogContent,
  Header: DialogHeader,
  Title: DialogTitle,
  Description: DialogDescription,
  Body: DialogBody,
  Footer: DialogFooter,
  KeyboardHints: DialogKeyboardHints,
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
export { DialogKeyboardHints, type DialogKeyboardHintsProps, type KeyboardHint };
