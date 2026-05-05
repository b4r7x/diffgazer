import { useEffect } from "react"
import { useNavigate } from "@tanstack/react-router"
import { useKey, useScope } from "@diffgazer/keys"
import { useSearchOpen } from "../search-context"
import {
  CommandPalette,
  CommandPaletteContent,
  CommandPaletteInput,
  CommandPaletteList,
  CommandPaletteItem,
  CommandPaletteFooter,
} from "@/components/ui/command-palette"
import { useSearch } from "../hooks/use-search"
import { getEnabledDocsLibraries } from "@/lib/docs-library"

const LIBRARY_LABELS: Record<string, string> = Object.fromEntries(
  getEnabledDocsLibraries().map((lib) => [lib.id, lib.displayName]),
)

const SECTION_LABELS: Record<string, string> = {
  components: "Components",
  "getting-started": "Getting Started",
  theme: "Theme",
  patterns: "Patterns",
  cli: "CLI",
  integrations: "Integrations",
  keys: "Keys",
  api: "API",
  guides: "Guides",
  hooks: "Hooks",
  features: "Features",
  configuration: "Configuration",
  general: "Docs",
}

export function SearchDialog() {
  const { open, setOpen } = useSearchOpen()
  const { query, results, search } = useSearch()
  const navigate = useNavigate()

  useKey({
    "mod+k": () => setOpen(true),
    "/": () => setOpen(true),
  }, { preventDefault: true })

  useScope("search", { enabled: open })

  useEffect(() => {
    if (!open) search("")
  }, [open, search])

  return (
    <CommandPalette
      open={open}
      onOpenChange={setOpen}
      search={query}
      onSearchChange={search}
      onActivate={(id) => navigate({ to: id })}
    >
      <CommandPaletteContent size="md">
        <CommandPaletteInput placeholder="Search docs..." />
        <CommandPaletteList>
          {!query && (
            <div className="p-4 text-center text-muted-foreground text-xs font-mono">
              Type to search docs...
            </div>
          )}
          {query && results.length === 0 && (
            <div className="p-4 text-center text-muted-foreground text-xs font-mono">
              No results found.
            </div>
          )}
          {query &&
            results.map((result) => (
              <CommandPaletteItem key={result.id} id={result.url}>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span>{result.title}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {SECTION_LABELS[result.section] ?? result.section}
                    </span>
                    <span className="text-[10px] text-muted-foreground/50">
                      {LIBRARY_LABELS[result.library] ?? result.library}
                    </span>
                  </div>
                  {result.excerpt && (
                    <span className="text-xs text-muted-foreground truncate">
                      {result.excerpt}
                    </span>
                  )}
                </div>
              </CommandPaletteItem>
            ))}
        </CommandPaletteList>
        <CommandPaletteFooter>
          <div className="flex gap-3">
            <span className="flex items-center gap-1">
              <span className="bg-border px-1 rounded text-muted-foreground">
                ↑↓
              </span>{" "}
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <span className="bg-border px-1 rounded text-muted-foreground">
                ↵
              </span>{" "}
              Select
            </span>
          </div>
          <div className="flex gap-2">
            <span className="flex items-center gap-1">
              Triggered by{" "}
              <span className="text-foreground">[cmd+k]</span>
            </span>
          </div>
        </CommandPaletteFooter>
      </CommandPaletteContent>
    </CommandPalette>
  )
}
