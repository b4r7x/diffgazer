import { useKey, useScope } from "@diffgazer/keys";
import {
  CommandPalette,
  CommandPaletteContent,
  CommandPaletteFooter,
  CommandPaletteInput,
  CommandPaletteItem,
  CommandPaletteList,
} from "@diffgazer/ui/components/command-palette";
import { Kbd } from "@diffgazer/ui/components/kbd";
import { Spinner } from "@diffgazer/ui/components/spinner";
import { useNavigate } from "@tanstack/react-router";
import { useSearchOpen } from "@/hooks/search-context";
import { getEnabledDocsLibraries } from "@/lib/library";
import { type SearchStatus, useSearch } from "../hooks/use-search";

const LIBRARY_LABELS: Record<string, string> = Object.fromEntries(
  getEnabledDocsLibraries().map((lib) => [lib.id, lib.displayName]),
);

// biome-ignore format: Phase 10 accept checks quoted section keys.
const SECTION_LABELS: Record<string, string> = {
  "components": "Components",
  "concepts": "Concepts",
  "getting-started": "Getting Started",
  "api": "API",
  "cli": "CLI",
  "guides": "Guides",
  "hooks": "Hooks",
  "integrations": "Integrations",
  "operations": "Operations",
  "patterns": "Patterns",
  "reference": "Reference",
  "theme": "Theme",
  "tui": "TUI",
  "utils": "Utilities",
  "web": "Web",
  "general": "Docs",
};

interface SearchStatusView {
  message: string;
  severity?: "error";
}

export function getSearchStatusView(
  hasQuery: boolean,
  status: SearchStatus,
  error: string | null,
): SearchStatusView | null {
  if (!hasQuery) {
    return { message: "Type to search docs..." };
  }
  if (status === "error") {
    return { message: error ?? "Search failed. Try again.", severity: "error" };
  }
  if (status === "empty") {
    return { message: "No results found." };
  }
  return null;
}

export function SearchDialog() {
  const { open, setOpen } = useSearchOpen();
  const { query, results, status, error, search } = useSearch();
  const navigate = useNavigate();
  const hasQuery = query.trim().length > 0;
  const statusView = getSearchStatusView(hasQuery, status, error);
  const showsResults = hasQuery && status === "success";

  useKey(
    {
      "mod+k": () => setOpen(true),
      "/": () => setOpen(true),
    },
    { preventDefault: true },
  );

  useScope("search", { enabled: open });

  let statusContent = null;
  if (status === "loading") {
    statusContent = (
      <div className="flex items-center justify-center min-h-[240px] text-muted-foreground text-xs font-mono">
        <Spinner variant="braille" size="sm">
          Searching docs...
        </Spinner>
      </div>
    );
  } else if (statusView) {
    statusContent = (
      <div
        role={statusView.severity === "error" ? "alert" : undefined}
        aria-live={statusView.severity === "error" ? "assertive" : undefined}
        className="flex items-center justify-center min-h-[240px] text-muted-foreground text-xs font-mono"
      >
        {statusView.message}
      </div>
    );
  }

  return (
    <CommandPalette
      open={open}
      onOpenChange={(next) => {
        if (!next) search("");
        setOpen(next);
      }}
      search={query}
      onSearchChange={search}
      onActivate={(id) => navigate({ to: id })}
      shouldFilter={false}
    >
      <CommandPaletteContent size="md">
        <CommandPaletteInput placeholder="Search docs..." />
        {statusContent}
        <CommandPaletteList className={showsResults ? "min-h-[240px]" : undefined}>
          {showsResults &&
            results.map((result) => (
              <CommandPaletteItem key={result.id} id={result.url}>
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span>{result.title}</span>
                    <span className="text-2xs text-muted-foreground">
                      {SECTION_LABELS[result.section] ?? result.section}
                    </span>
                    <span className="text-2xs text-muted-foreground/50">
                      {LIBRARY_LABELS[result.library] ?? result.library}
                    </span>
                  </div>
                  {result.excerpt && (
                    <span className="text-xs text-muted-foreground truncate">{result.excerpt}</span>
                  )}
                </div>
              </CommandPaletteItem>
            ))}
        </CommandPaletteList>
        <CommandPaletteFooter>
          <div className="flex gap-3">
            <span className="flex items-center gap-1">
              <Kbd size="sm">↑↓</Kbd> Navigate
            </span>
            <span className="flex items-center gap-1">
              <Kbd size="sm">↵</Kbd> Select
            </span>
          </div>
          <div className="flex gap-2">
            <span className="flex items-center gap-1">
              Triggered by <Kbd size="sm">⌘K</Kbd>
            </span>
          </div>
        </CommandPaletteFooter>
      </CommandPaletteContent>
    </CommandPalette>
  );
}
