"use client";

import { useRef } from "react";
import {
  Dialog,
  DialogAction,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
// @hidden-imports-ok — demo imports the useNavigation re-export from the hidden use-navigation hook registry item
import { useNavigation } from "@/hooks/use-navigation";

export default function DialogKeyboard() {
  const containerRef = useRef<HTMLDivElement>(null);

  const { onKeyDown } = useNavigation({
    containerRef,
    role: "button",
    orientation: "horizontal",
    moveFocus: true,
  });

  return (
    <Dialog>
      <DialogTrigger>Delete Branch</DialogTrigger>
      <DialogContent role="alertdialog" closeOnBackdropClick={false}>
        <DialogHeader>
          <DialogTitle>Delete Branch</DialogTitle>
          <DialogDescription>This action cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogBody>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Are you sure you want to delete{" "}
            <span className="text-foreground font-mono">feature/auth-refactor</span>?
          </p>
        </DialogBody>
        {/* biome-ignore lint/a11y/noStaticElementInteractions: keyboard-navigation wrapper for the dialog action row; arrow-key handling is delegated here while focus stays on the inner buttons. */}
        <div ref={containerRef} onKeyDown={onKeyDown}>
          <DialogFooter
            hints={[
              { key: "Esc", label: "Close" },
              { key: "←/→", label: "Navigate" },
              { key: "Enter", label: "Confirm" },
            ]}
          >
            <DialogClose data-value="cancel" bracket variant="ghost">
              Cancel
            </DialogClose>
            <DialogAction data-value="delete" variant="destructive" bracket>
              Delete
            </DialogAction>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
