"use client"

import { useNavigation } from "@diffgazer/keys"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogClose,
  DialogAction,
  DialogKeyboardHints,
} from "@/components/ui/dialog"
import { useRef } from "react"

export default function DialogKeyboard() {
  const containerRef = useRef<HTMLDivElement>(null)

  const { onKeyDown } = useNavigation({
    containerRef,
    role: "button",
    orientation: "horizontal",
    moveFocus: true,
  })

  return (
    <Dialog>
      <DialogTrigger>Delete Branch</DialogTrigger>
      <DialogContent role="alertdialog" closeOnBackdropClick={false}>
        <DialogHeader>
          <DialogTitle>Delete Branch</DialogTitle>
          <DialogDescription>
            This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Are you sure you want to delete{" "}
            <span className="text-foreground font-mono">feature/auth-refactor</span>?
          </p>
        </DialogBody>
        <div ref={containerRef} onKeyDown={onKeyDown}>
          <DialogFooter>
            <DialogClose data-value="cancel" bracket variant="ghost">Cancel</DialogClose>
            <DialogAction data-value="delete" variant="destructive" bracket>Delete</DialogAction>
          </DialogFooter>
        </div>
        <DialogKeyboardHints hints={[
          { key: "Esc", label: "Close" },
          { key: "←→", label: "Navigate" },
          { key: "Enter", label: "Confirm" },
        ]} />
      </DialogContent>
    </Dialog>
  )
}
