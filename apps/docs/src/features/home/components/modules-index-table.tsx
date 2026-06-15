import { Panel } from "@diffgazer/ui/components/panel";
import { Link } from "@tanstack/react-router";
import type { DocsLibraryId } from "@/lib/library";
import type { HomeLibrary } from "../data";

const LIBRARY_DESCRIPTIONS: Record<DocsLibraryId, string> = {
  app: "AI code review in your terminal. Local-first.",
  ui: "Primitive & compound TUI building blocks.",
  keys: "Headless keyboard, focus, & scope primitives.",
};

function itemsLabel(library: HomeLibrary): string {
  const components = library.sections.find((s) => s.name === "Components");
  const hooks = library.sections.find((s) => s.name === "Hooks");
  if (components && components.count > 0) return `${components.count} Comp`;
  if (hooks && hooks.count > 0) return `${hooks.count} Hooks`;
  return "--";
}

function actionLabel(library: HomeLibrary): string {
  if (library.id === "app") return "[ OPEN_DOCS ]";
  return "[ BROWSE ]";
}

export function ModulesIndexTable({ libraries }: { libraries: HomeLibrary[] }) {
  return (
    <Panel frame="hairline" className="flex flex-col lg:min-h-0 lg:flex-1">
      <div className="flex shrink-0 border-b border-border bg-secondary px-4 py-2 font-mono text-2xs font-bold uppercase tracking-widest text-muted-foreground">
        <div className="w-1/2 sm:w-1/3">Package / Scope</div>
        <div className="hidden w-1/4 sm:block">Description</div>
        <div className="w-1/4 text-right sm:w-1/6">Items</div>
        <div className="w-1/4 text-right">Status / Action</div>
      </div>
      <nav
        aria-label="Documentation packages"
        className="p-2 lg:min-h-0 lg:flex-1 lg:overflow-auto"
      >
        {libraries.map((library) => (
          <Link
            key={library.id}
            to="/$lib/$"
            params={{ lib: library.id, _splat: library.sections[0]?.splat ?? "" }}
            className="group flex items-center border border-transparent px-2 py-3 font-mono text-sm transition-colors hover:border-border hover:bg-secondary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <div className="flex w-1/2 min-w-0 items-center sm:w-1/3">
              <span
                className="mr-2 text-muted-foreground transition-colors group-hover:text-foreground"
                aria-hidden="true"
              >
                ▶
              </span>
              <span className="truncate font-bold text-foreground">{library.displayName}</span>
            </div>
            <div className="hidden w-1/4 truncate pr-4 text-muted-foreground sm:block">
              {LIBRARY_DESCRIPTIONS[library.id]}
            </div>
            <div className="w-1/4 text-right text-foreground sm:w-1/6">{itemsLabel(library)}</div>
            <div className="w-1/4 text-right text-2xs uppercase tracking-widest text-muted-foreground transition-colors group-hover:text-foreground">
              {actionLabel(library)}
            </div>
          </Link>
        ))}
        <div
          aria-hidden="true"
          className="mt-4 flex items-center gap-4 px-2 py-3 font-mono text-2xs uppercase tracking-widest text-muted-foreground opacity-50"
        >
          <span className="grow border-b border-dashed border-border" />
          <span>END OF DIRECTORY</span>
          <span className="grow border-b border-dashed border-border" />
        </div>
      </nav>
    </Panel>
  );
}
