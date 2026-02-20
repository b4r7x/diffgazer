import { Logo } from "@/components/ui/logo/logo"
import { Divider } from "@/components/ui/divider/divider"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { useSearchOpen } from "@/features/search/search-context"
import { Link, useLocation } from "@tanstack/react-router"
import { docsLibraryIds, getDocsLibrary, inferDocsLibraryFromPath } from "@/lib/docs-library"
import { cn } from "@/lib/utils"

export function Header() {
  const { setOpen } = useSearchOpen()
  const pathname = useLocation({ select: (location) => location.pathname })
  const activeLibraryId = inferDocsLibraryFromPath(pathname)
  const activeLibrary = getDocsLibrary(activeLibraryId)

  return (
    <header className="shrink-0 bg-background z-20 flex flex-col border-b border-border">
      <div className="px-6 h-24 flex justify-between items-center w-full">
        <div className="flex items-start gap-2 mt-2">
          <Logo text={activeLibrary.logoText} className="text-foreground text-[6px] sm:text-[8px]" />
          <span className="bg-border text-foreground px-1.5 py-0.5 text-xs rounded-sm mt-2">
            v{activeLibrary.version}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center rounded-sm border border-border bg-background p-0.5">
            {docsLibraryIds.map((libraryId) => {
              const library = getDocsLibrary(libraryId)
              const isActive = libraryId === activeLibraryId

              return (
                <Link
                  key={libraryId}
                  to="/docs/$"
                  params={{ _splat: library.defaultDocPath }}
                  className={cn(
                    "px-2.5 py-1 text-xs font-mono transition-colors",
                    isActive
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {library.name}
                </Link>
              )
            })}
          </div>
          <a
            href={activeLibrary.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors font-medium"
          >
            GitHub
          </a>
          <div className="relative group cursor-text">
            <input
              className="bg-background border border-border text-xs w-64 px-3 py-1.5 rounded-sm placeholder:text-muted-foreground/70 text-foreground focus:border-foreground focus:ring-0 transition-colors"
              placeholder="Search documentation..."
              type="text"
              readOnly
              onClick={() => setOpen(true)}
              aria-label="Search documentation"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1 pointer-events-none">
              <span className="border border-border bg-border/30 px-1.5 py-0.5 text-[10px] rounded-sm text-muted-foreground group-hover:border-muted-foreground group-hover:text-foreground transition-colors">/</span>
            </div>
          </div>
        </div>
      </div>

      <Divider />

      <div className="px-6 py-2 text-xs text-muted-foreground">
        <Breadcrumbs />
      </div>
    </header>
  )
}
