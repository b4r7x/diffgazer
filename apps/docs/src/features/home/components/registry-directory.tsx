import { getNavigationItemProps, useScopedNavigation } from "@diffgazer/keys";
import { cn } from "@diffgazer/ui/lib/utils";
import { Link } from "@tanstack/react-router";
import { useRef } from "react";
import { CHROME_LABEL_CLASS } from "@/components/shared/chrome-label";
import { FOCUS_RING_CLASS } from "@/components/shared/focus-ring";
import type { DocsLibraryId } from "@/lib/library";
import type { HomeLibrary } from "../data";

const LIBRARY_DESCRIPTIONS: Record<DocsLibraryId, string> = {
  app: "AI code review in your terminal. Local-first.",
  ui: "Primitive & compound TUI building blocks.",
  keys: "Headless keyboard, focus, & scope primitives.",
};

function itemsLabel(library: HomeLibrary): string {
  // The app package ships the diffgazer binary, not a component/hook registry.
  if (library.id === "app") return "CLI";
  const components = library.sections.find((section) => section.name === "Components");
  if (components) return `${components.count} Comp`;
  const hooks = library.sections.find((section) => section.name === "Hooks");
  // A library with neither section has nothing to count; "0 Hooks" would be a lie.
  return hooks ? `${hooks.count} Hooks` : "";
}

export function RegistryDirectory({ libraries }: { libraries: HomeLibrary[] }) {
  const listRef = useRef<HTMLElement>(null);

  const { isHighlighted, highlight } = useScopedNavigation<DocsLibraryId>({
    containerRef: listRef,
    role: "button",
    wrap: false,
    focusWithinOnly: true,
    // The rows are links, so DOM focus is the anchor j/k step from. Without moving focus
    // along, the marker and the focused row drift apart and Enter opens the focused
    // package instead of the marked one.
    moveFocus: true,
    upKeys: ["ArrowUp", "k"],
    downKeys: ["ArrowDown", "j"],
    onSelect: (libraryId) => {
      const link = listRef.current?.querySelector<HTMLAnchorElement>(
        `[data-diffgazer-navigation-item][data-value="${libraryId}"]`,
      );
      link?.click();
    },
  });

  return (
    <nav
      ref={listRef}
      aria-label="Documentation packages"
      // scroll-py-2 covers FOCUS_RING_CLASS's 4px outset (2px outline, 2px offset)
      // so navigation never parks a row with its ring past the clipped edge.
      className="px-2 py-1 sm:p-2 scroll-py-2 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
    >
      {libraries.map((library) => (
        <Link
          key={library.id}
          {...getNavigationItemProps("button", library.id)}
          to="/$lib/$"
          params={{ lib: library.id, _splat: library.sections[0]?.splat ?? "" }}
          data-highlighted={isHighlighted(library.id) ? "" : undefined}
          onMouseEnter={() => highlight(library.id)}
          className={`group grid grid-cols-[1rem_minmax(0,1fr)_auto] items-baseline gap-x-2 border border-transparent px-2 py-2 font-mono transition-colors sm:py-2.5 hover:border-border hover:bg-secondary data-[highlighted]:border-border data-[highlighted]:bg-secondary ${FOCUS_RING_CLASS}`}
        >
          <div
            aria-hidden="true"
            className="text-center text-sm text-muted-foreground transition-colors group-hover:text-foreground group-data-[highlighted]:text-foreground"
          >
            {isHighlighted(library.id) ? "▸" : "›"}
          </div>
          <div className="truncate text-sm font-bold text-foreground">{library.displayName}</div>
          <div className="flex items-baseline justify-end gap-1 text-xs text-muted-foreground">
            <span>{itemsLabel(library)}</span>
            <span
              aria-hidden="true"
              className="transition-colors group-hover:text-foreground group-data-[highlighted]:text-foreground"
            >
              →
            </span>
          </div>
          <div className="col-span-2 col-start-2 mt-0.5 text-xs leading-snug text-muted-foreground">
            {LIBRARY_DESCRIPTIONS[library.id]}
          </div>
        </Link>
      ))}
      {/* Last block of the hero, so its sub-`sm` margin and padding come straight out
          of the fold budget described in hero-panel.tsx. Widen only above `sm`. */}
      <div
        aria-hidden="true"
        className={cn(CHROME_LABEL_CLASS, "mt-1 flex items-center gap-4 px-2 py-1 sm:mt-4 sm:py-3")}
      >
        <span className="grow border-b border-dashed border-border" />
        <span>END OF DIRECTORY</span>
        <span className="grow border-b border-dashed border-border" />
      </div>
    </nav>
  );
}
