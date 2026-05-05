import { Dialog as DialogRoot, type DialogProps } from "./dialog";
import { DialogTrigger, type DialogTriggerProps, type DialogTriggerRenderProps } from "./dialog-trigger";
import { DialogContent, type DialogContentProps } from "./dialog-content";
import { DialogHeader, type DialogHeaderProps } from "./dialog-header";
import { DialogTitle, type DialogTitleProps } from "./dialog-title";
import { DialogDescription, type DialogDescriptionProps } from "./dialog-description";
import { DialogBody, type DialogBodyProps } from "./dialog-body";
import { DialogFooter, type DialogFooterProps } from "./dialog-footer";
import { DialogKeyboardHints, type DialogKeyboardHintsProps, type KeyboardHint } from "./dialog-keyboard-hints";
import { DialogClose, type DialogCloseProps } from "./dialog-close";
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
  Action: DialogAction,
  KeyboardHints: DialogKeyboardHints,
});

export { Dialog, type DialogProps };
export { DialogTrigger, type DialogTriggerProps, type DialogTriggerRenderProps };
export { DialogContent, type DialogContentProps };
export { DialogHeader, type DialogHeaderProps };
export { DialogTitle, type DialogTitleProps };
export { DialogDescription, type DialogDescriptionProps };
export { DialogBody, type DialogBodyProps };
export { DialogFooter, type DialogFooterProps };
export { DialogClose, type DialogCloseProps };
export { DialogAction, type DialogActionProps };
export { DialogKeyboardHints, type DialogKeyboardHintsProps, type KeyboardHint };
