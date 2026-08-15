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
        <DialogFooter
          ref={containerRef}
          onKeyDown={onKeyDown}
          hints={[
            { key: "Esc", label: "Close" },
            { key: "←/→", label: "Navigate" },
            { key: "Enter", label: "Confirm" },
          ]}
        >
          <DialogClose data-value="cancel" bracket>
            Cancel
          </DialogClose>
          <DialogAction data-value="delete" variant="destructive">
            Delete
          </DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
