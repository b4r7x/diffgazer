"use client"

import { useState } from "react"
import { KeyboardProvider, useKey, useScope } from "@diffgazer/keys"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog"
import { Kbd, KbdGroup } from "@/components/ui/kbd"

function App() {
  const [modalOpen, setModalOpen] = useState(false)

  useKey("ctrl+k", () => setModalOpen(true))

  return (
    <div>
      <p className="text-sm text-muted-foreground">
        Press <KbdGroup><Kbd size="sm">Ctrl</Kbd><Kbd size="sm">K</Kbd></KbdGroup> to open modal
      </p>
      {modalOpen && <Modal onClose={() => setModalOpen(false)} />}
    </div>
  )
}

function Modal({ onClose }: { onClose: () => void }) {
  useScope("modal")

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle decorated={false}>Modal</DialogTitle>
          <DialogDescription>
            <Kbd size="sm">Esc</Kbd> closes this modal. <KbdGroup><Kbd size="sm">Ctrl</Kbd><Kbd size="sm">K</Kbd></KbdGroup> is blocked while this scope is active.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <p className="text-sm text-muted-foreground">
            The modal scope isolates keyboard shortcuts so parent bindings don't fire.
          </p>
        </DialogBody>
        <DialogFooter>
          <DialogClose variant="ghost" bracket>Close</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function UseScopeBasic() {
  return (
    <KeyboardProvider>
      <App />
    </KeyboardProvider>
  )
}
