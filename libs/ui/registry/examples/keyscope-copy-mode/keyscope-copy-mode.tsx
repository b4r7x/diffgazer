"use client";

/**
 * Copy-mode example: components use locally copied hooks
 * instead of the @diffgazer/keys package.
 *
 * In this mode:
 *   dgadd add menu --integration copy
 *   (or) dgadd add keys/navigation keys/focus-trap keys/scroll-lock
 *
 * Hooks are copied into your project at @/hooks/ and components
 * import from local paths. No @diffgazer/keys package dependency required.
 *
 * Note: KeyboardProvider, useKey, useScope, and useFocusZone are
 * NOT available in copy mode — only standalone hooks are copied.
 */
import { useState, useRef, type KeyboardEvent } from "react"
import { useNavigation } from "@/hooks/use-navigation"
import { Menu, MenuItem, MenuDivider } from "@/components/ui/menu"
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
} from "@/components/ui/dialog"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectValue,
} from "@/components/ui/select"

export default function KeyscopeCopyMode() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [branch, setBranch] = useState("")

  return (
    <div className="flex gap-4 w-full max-w-3xl">
      {/* Sidebar with keyboard navigation via local hook */}
      <FileMenu selectedFile={selectedFile} onSelectFile={setSelectedFile} />

      {/* Main content */}
      <div className="flex-1 border border-border">
        <div className="p-2 text-xs text-muted-foreground border-b border-border font-mono">
          EDITOR
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

      {/* Confirm dialog (uses useFocusTrap + useScrollLock internally) */}
      <Dialog>
        <DialogTrigger className="fixed bottom-4 right-4 text-xs text-muted-foreground font-mono border border-border px-2 py-1 hover:bg-muted">
          Save (Ctrl+S)
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Save</DialogTitle>
          </DialogHeader>
          <DialogBody>
            <p className="text-sm text-muted-foreground">
              Save changes to {selectedFile ?? "the current file"}?
            </p>
          </DialogBody>
          <DialogFooter>
            <DialogClose bracket variant="ghost">Cancel</DialogClose>
            <DialogAction>Save</DialogAction>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/**
 * Example of useNavigation from a locally copied hook.
 * The hook returns an onKeyDown handler — no provider needed.
 */
function FileMenu({
  selectedFile,
  onSelectFile,
}: {
  selectedFile: string | null
  onSelectFile: (file: string) => void
}) {
  const listRef = useRef<HTMLDivElement>(null)

  const { onKeyDown: navKeyDown } = useNavigation({
    containerRef: listRef,
    role: "option",
    value: selectedFile,
    onHighlightChange: onSelectFile,
    onEnter: onSelectFile,
    wrap: true,
  })

  const handleKeyDown = (event: KeyboardEvent) => {
    navKeyDown(event)
  }

  return (
    <div className="w-64 shrink-0 border border-border">
      <div className="p-2 text-xs text-muted-foreground border-b border-border font-mono">
        FILES
      </div>
      <Menu
        ref={listRef}
        selectedId={selectedFile}
        onSelect={onSelectFile}
        onKeyDown={handleKeyDown}
        aria-label="File list"
      >
        <MenuItem id="readme">README.md</MenuItem>
        <MenuItem id="package">package.json</MenuItem>
        <MenuItem id="index">src/index.ts</MenuItem>
        <MenuDivider />
        <MenuItem id="new">+ New File</MenuItem>
      </Menu>
    </div>
  )
}
