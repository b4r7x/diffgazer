"use client";

import { useState, useTransition, type MouseEvent } from "react"
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogClose,
  DialogAction,
  DialogKeyboardHints,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const CREATE_DELAY_MS = 1000

function wait(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms))
}

export default function DialogForm() {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [submitting, startCreate] = useTransition()

  const resetForm = () => {
    setName("")
  }

  const handleOpenChange = (nextOpen: boolean) => {
    if (submitting && !nextOpen) return
    setOpen(nextOpen)
    if (!nextOpen) resetForm()
  }

  const handleCreate = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault()
    if (!name.trim() || submitting) return

    startCreate(async () => {
      await wait(CREATE_DELAY_MS)
      setName("")
      setOpen(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger>New Project</DialogTrigger>
      <DialogContent
        size="md"
        closeOnBackdropClick={!submitting}
        onEscapeKeyDown={(e) => {
          if (submitting) e.preventDefault()
        }}
      >
        <DialogHeader>
          <DialogTitle>Create Project</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-4">
            <Label label="Project Name">
              <Input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="my-project"
              />
            </Label>
          </div>
        </DialogBody>
        <DialogFooter>
          <DialogClose bracket variant="ghost" disabled={submitting}>Cancel</DialogClose>
          <DialogAction
            disabled={!name.trim() || submitting}
            loading={submitting}
            onClick={handleCreate}
          >
            {submitting ? "Creating..." : "Create"}
          </DialogAction>
        </DialogFooter>
        <DialogKeyboardHints hints={[{ key: "Esc", label: "Close" }, { key: "Enter", label: "Submit" }]} />
      </DialogContent>
    </Dialog>
  )
}
