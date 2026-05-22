import type { ComponentType, LazyExoticComponent, ReactNode } from "react"
import { Suspense } from "react"
import { Spinner } from "@/components/ui/spinner/spinner"
import { Kbd } from "@/components/ui/kbd/kbd"

/**
 * A3 docs-shell inset for layout-shaped component examples (Sidebar, etc.).
 * The demo lives in a left rail of fixed width; the right pane is a faked
 * docs page (sticky topbar, breadcrumb, h1, paragraph, code silhouette, ToC)
 * so the reader sees the component IN context. Right-pane content is purely
 * decorative — `aria-hidden` so screen readers don't announce placeholder text.
 */

const EMPTY_FALLBACK = <div aria-hidden="true" className="h-full w-full" />

const LOADING_FALLBACK = (
  <div className="flex h-full w-full items-center justify-center">
    <Spinner variant="pulse" size="sm" />
  </div>
)

function DemoSlot({ demo: Demo }: { demo: LazyExoticComponent<ComponentType> | null }) {
  if (!Demo) return EMPTY_FALLBACK
  return (
    <Suspense fallback={LOADING_FALLBACK}>
      <Demo />
    </Suspense>
  )
}

function InsetToolbar() {
  return (
    <div
      aria-hidden="true"
      className="flex items-center justify-between h-8 px-3 border-b border-border bg-secondary/40 text-[10px] uppercase tracking-[0.10em] text-muted-foreground"
    >
      <span className="inline-flex gap-1.5">
        <span className="w-2 h-2 border border-border" />
        <span className="w-2 h-2 border border-border" />
        <span className="w-2 h-2 border border-border" />
      </span>
      <span className="text-muted-foreground/60">preview · sidebar in context</span>
      <span className="opacity-0">·</span>
    </div>
  )
}

function FauxDocsTopbar() {
  return (
    <header
      aria-hidden="true"
      className="sticky top-0 z-10 h-10 px-4 flex items-center justify-between border-b border-border/60 bg-background/90 backdrop-blur text-[11px] text-muted-foreground"
    >
      <span className="inline-flex items-center gap-2 text-foreground font-bold uppercase tracking-[0.08em]">
        <span className="w-2.5 h-2.5 bg-foreground" />
        Diffgazer
      </span>
      <nav className="inline-flex gap-4">
        <span className="text-foreground">Docs</span>
        <span>Registry</span>
        <span>Changelog</span>
      </nav>
      <span className="flex items-center justify-between min-w-[180px] h-5 px-2 border border-border/60 bg-secondary/30">
        <span>Search docs…</span>
        <Kbd size="sm">⌘K</Kbd>
      </span>
    </header>
  )
}

function FauxDocsBody({ children }: { children: ReactNode }) {
  return (
    <div aria-hidden="true" className="@container/inset px-6 py-6 min-w-0">
      <div className="grid grid-cols-1 @[520px]/inset:grid-cols-[1fr_140px] gap-6 items-start">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground mb-3">
            Docs / Components / <span className="text-foreground">Sidebar</span>
          </p>
          <h1 className="text-[22px] font-bold text-foreground leading-tight mb-2.5">Sidebar</h1>
          <p className="text-muted-foreground text-[13px] leading-relaxed max-w-[56ch] mb-3.5">
            A composable navigation surface for product layouts. Section titles, items,
            badges, and a sticky footer.
          </p>
          <div className="border border-border/60 bg-secondary/40 p-3.5 my-4 max-w-[60ch] space-y-2">
            <span className="block h-2 w-11/12 bg-foreground/10" />
            <span className="block h-2 w-3/4 bg-foreground/10" />
            <span className="block h-2 w-9/12 bg-foreground/10" />
            <span className="block h-2 w-1/2 bg-foreground/10" />
          </div>
          {children}
        </div>
        <aside className="hidden @[520px]/inset:block sticky top-10 pl-3 border-l border-border/60 text-muted-foreground text-[11px]">
          <p className="uppercase tracking-[0.14em] text-[10px] mb-2.5">On this page</p>
          <ul className="space-y-1">
            <li className="text-foreground">Overview</li>
            <li className="text-muted-foreground/80">Anatomy</li>
            <li className="text-muted-foreground/80">Keyboard</li>
          </ul>
        </aside>
      </div>
    </div>
  )
}

export function InsetPreviewPane({ demo }: { demo: LazyExoticComponent<ComponentType> | null }) {
  return (
    <div className="border border-border bg-background overflow-hidden">
      <InsetToolbar />
      <div className="grid grid-cols-[minmax(248px,max-content)_1fr] h-[440px]">
        <div className="border-r border-border flex flex-col items-stretch bg-background overflow-auto scrollbar-thin [&>*]:min-w-0">
          <DemoSlot demo={demo} />
        </div>
        <div className="flex flex-col min-w-0 bg-background relative">
          <FauxDocsTopbar />
          <FauxDocsBody>
            <p className="text-muted-foreground text-[12.5px] leading-7 max-w-[60ch]">
              Compose with <span className="text-foreground font-bold">SidebarHeader</span>,
              <span className="text-foreground font-bold"> SidebarContent</span>, and
              <span className="text-foreground font-bold"> SidebarFooter</span>. Items
              support active and disabled states.
            </p>
          </FauxDocsBody>
        </div>
      </div>
    </div>
  )
}
