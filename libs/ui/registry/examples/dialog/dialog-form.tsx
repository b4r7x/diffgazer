"use client";

import { useState } from "react"
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

export default function DialogForm() {
  const [name, setName] = useState("")
  const [submitting, setSubmitting] = useState(false)

  return (
    <Dialog>
      <DialogTrigger>New Project</DialogTrigger>
      <DialogContent
        size="md"
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
            onClick={(e) => {
              e.preventDefault()
              setSubmitting(true)
              setTimeout(() => setSubmitting(false), 1000)
            }}
          >
            {submitting ? "Creating..." : "Create"}
          </DialogAction>
        </DialogFooter>
        <DialogKeyboardHints hints={[{ key: "Esc", label: "Close" }, { key: "Enter", label: "Submit" }]} />
      </DialogContent>
    </Dialog>
  )
}
