"use client";

import { useState, useRef } from "react"
import { KeyboardProvider, useKey, useScope, useFocusZone } from "@diffgazer/keys"
import { Menu, MenuItem, MenuDivider } from "@/components/ui/menu"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  DialogClose,
  DialogAction,
} from "@/components/ui/dialog"
import {
  CommandPalette,
  CommandPaletteContent,
  CommandPaletteInput,
  CommandPaletteList,
  CommandPaletteGroup,
  CommandPaletteItem,
  CommandPaletteFooter,
} from "@/components/ui/command-palette"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select"

function AppContent() {
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [branch, setBranch] = useState("")

  const sidebarRef = useRef<HTMLDivElement>(null)
  const mainRef = useRef<HTMLDivElement>(null)

  // Focus zones: sidebar and main content
  const { inZone, forZone } = useFocusZone({
    initial: "sidebar",
    zones: ["sidebar", "main"] as const,
    tabCycle: ["sidebar", "main"] as const,
    transitions: ({ zone: z, key }) => {
      if (z === "sidebar" && key === "ArrowRight") return "main"
      if (z === "main" && key === "ArrowLeft") return "sidebar"
      return null
    },
  })

  // Global shortcuts (work in any zone)
  useKey("mod+k", () => setPaletteOpen(true), { preventDefault: true })
  useKey("mod+d", () => setDialogOpen(true), { preventDefault: true })

  // Sidebar-only shortcut
  useKey("n", () => setSelectedFile("new"), forZone("sidebar"))

  return (
    <div className="flex gap-4 w-full max-w-3xl">
      {/* Sidebar zone */}
      <div
        ref={sidebarRef}
        className={`w-64 shrink-0 border border-border ${inZone("sidebar") ? "ring-1 ring-foreground" : ""}`}
      >
        <div className="p-2 text-xs text-muted-foreground border-b border-border font-mono">
          FILES {inZone("sidebar") && <span className="text-foreground">[active]</span>}
        </div>
        <Menu
          selectedId={selectedFile}
          onSelect={setSelectedFile}
          aria-label="File list"
        >
          <MenuItem id="readme">README.md</MenuItem>
          <MenuItem id="package">package.json</MenuItem>
          <MenuItem id="index">src/index.ts</MenuItem>
          <MenuDivider />
          <MenuItem id="new">+ New File</MenuItem>
        </Menu>
      </div>

      {/* Main content zone */}
      <div
        ref={mainRef}
        className={`flex-1 border border-border ${inZone("main") ? "ring-1 ring-foreground" : ""}`}
      >
        <div className="p-2 text-xs text-muted-foreground border-b border-border font-mono">
          EDITOR {inZone("main") && <span className="text-foreground">[active]</span>}
        </div>
        <div className="p-4 space-y-4">
          <div className="w-48">
            <Select value={branch} onChange={(v) => setBranch(v as string)}>
              <SelectTrigger>
                <SelectValue placeholder="Branch..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="main">main</SelectItem>
                <SelectItem value="develop">develop</SelectItem>
                <SelectItem value="feature/auth">feature/auth</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="text-sm text-muted-foreground font-mono">
            {selectedFile
              ? `Editing: ${selectedFile}`
              : "Select a file from the sidebar"}
          </div>
        </div>
      </div>

      {/* Dialog with scoped keys */}
      <ConfirmDialog open={dialogOpen} onOpenChange={setDialogOpen} />

      {/* Command palette with scoped keys */}
      <AppCommandPalette
        open={paletteOpen}
        onOpenChange={setPaletteOpen}
        onSelectFile={setSelectedFile}
      />

      {/* Keyboard hints */}
      <div className="fixed bottom-4 right-4 text-[10px] text-muted-foreground font-mono space-y-0.5">
        <div>Tab &mdash; cycle zones</div>
        <div>Arrows &mdash; move between zones</div>
        <div>Cmd+K &mdash; command palette</div>
        <div>Cmd+D &mdash; confirm dialog</div>
        <div>N (sidebar) &mdash; new file</div>
      </div>
    </div>
  )
}

function ConfirmDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  // Scope isolates keyboard context while dialog is open
  useScope("dialog", { enabled: open })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm Action</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <p className="text-sm text-muted-foreground">
            Save changes to the current file?
          </p>
        </DialogBody>
        <DialogFooter>
          <DialogClose bracket variant="ghost">Cancel</DialogClose>
          <DialogAction>Save</DialogAction>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function AppCommandPalette({
  open,
  onOpenChange,
  onSelectFile,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectFile: (file: string) => void
}) {
  // Scope isolates keyboard context while palette is open
  useScope("palette", { enabled: open })

  const handleActivate = (id: string) => {
    if (id === "readme" || id === "package" || id === "index") {
      onSelectFile(id)
    }
  }

  return (
    <CommandPalette open={open} onOpenChange={onOpenChange} onActivate={handleActivate}>
      <CommandPaletteContent>
        <CommandPaletteInput placeholder="Search commands..." />
        <CommandPaletteList>
          <CommandPaletteGroup heading="Files">
            <CommandPaletteItem id="readme">README.md</CommandPaletteItem>
            <CommandPaletteItem id="package">package.json</CommandPaletteItem>
            <CommandPaletteItem id="index">src/index.ts</CommandPaletteItem>
          </CommandPaletteGroup>
          <CommandPaletteGroup heading="Actions">
            <CommandPaletteItem id="save" shortcut="Cmd+S">Save</CommandPaletteItem>
            <CommandPaletteItem id="close" shortcut="Cmd+W">Close File</CommandPaletteItem>
          </CommandPaletteGroup>
        </CommandPaletteList>
        <CommandPaletteFooter>
          <span className="flex items-center gap-1">
            <span className="bg-border px-1 rounded text-gray-300">
              &uarr;&darr;
            </span>{" "}
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <span className="bg-border px-1 rounded text-gray-300">
              &crarr;
            </span>{" "}
            Select
          </span>
        </CommandPaletteFooter>
      </CommandPaletteContent>
    </CommandPalette>
  )
}

export default function KeyscopeIntegration() {
  return (
    <KeyboardProvider>
      <AppContent />
    </KeyboardProvider>
  )
}
