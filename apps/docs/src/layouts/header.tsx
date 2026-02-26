import { useState } from "react"
import { useLocation, useNavigate, useRouterState } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { Logo } from "@/components/ui/logo/logo"
import { Spinner } from "@/components/ui/spinner/spinner"
import { Divider } from "@/components/ui/divider/divider"
import {
  Select,
  SelectTrigger,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { useSearchOpen } from "@/features/search/search-context"
import { cn } from "@/lib/utils"
import {
  DOCS_LIBRARY_IDS,
  docsPath,
  getDocsLibraryConfig,
  getRouteSlugsFromPathname,
  isDocsLibraryId,
  routeSlugsFromSourcePath,
  sourceSlugsForLibrary,
  type DocsLibraryId,
} from "@/lib/docs-library"

const resolveLibrarySwitchPath = createServerFn({ method: "GET" })
  .inputValidator((input: { targetLibrary: DocsLibraryId; currentSlugs: string[] }) => input)
  .handler(async ({ data }) => {
    const { source } = await import("@/lib/source")
    const sourceSlugs = sourceSlugsForLibrary(data.targetLibrary, data.currentSlugs)
    const targetPage = source.getPage(sourceSlugs)

    if (!targetPage) {
      return docsPath(data.targetLibrary)
    }

    const targetSlugs = routeSlugsFromSourcePath(data.targetLibrary, targetPage.path)
    if (!targetSlugs) {
      return docsPath(data.targetLibrary)
    }

    return docsPath(data.targetLibrary, targetSlugs)
  })

interface HeaderProps {
  library: DocsLibraryId
}

function isDocsPath(pathname?: string | null): boolean {
  if (!pathname) return false
  return /^\/[^/]+\/docs(?:\/|$)/.test(pathname)
}

export function Header({ library }: HeaderProps) {
  const { setOpen } = useSearchOpen()
  const pathname = useLocation({ select: (location) => location.pathname })
  const pendingDocsPathname = useRouterState({
    select: (state) => {
      const pendingMatches = state.pendingMatches
      const nextPathname = pendingMatches?.[pendingMatches.length - 1]?.pathname
      return isDocsPath(nextPathname) ? nextPathname : null
    },
  })
  const navigate = useNavigate()
  const [switching, setSwitching] = useState(false)
  const activeLibrary = getDocsLibraryConfig(library)
  const isHeaderBusy = switching || pendingDocsPathname !== null

  const handleLibraryChange = async (nextValue: string) => {
    if (!isDocsLibraryId(nextValue)) return

    const targetLibrary = getDocsLibraryConfig(nextValue)
    if (!targetLibrary.enabled || nextValue === library) return

    setSwitching(true)
    try {
      const currentSlugs = getRouteSlugsFromPathname(pathname, library)
      const targetPath = await resolveLibrarySwitchPath({
        data: {
          targetLibrary: nextValue,
          currentSlugs,
        },
      })

      // Parse targetPath to extract library and slugs
      const pathSegments = targetPath.split("/").filter(Boolean)
      const targetLib = pathSegments[0]
      const slugs = pathSegments.slice(2) // Skip lib and "docs"

      await navigate({
        to: "/$lib/docs/$",
        params: { lib: targetLib, _splat: slugs.join("/") },
      })
    } finally {
      setSwitching(false)
    }
  }

  return (
    <header className="shrink-0 bg-background z-20 flex flex-col border-b border-border" aria-busy={isHeaderBusy}>
      <div className="px-6 h-24 flex justify-between items-center w-full">
        <div className="flex items-start gap-2 mt-2">
          <Logo
            text={activeLibrary.logoText}
            className="text-foreground text-[6px] sm:text-[8px] transition-opacity duration-150"
          />
          <span className="bg-border text-foreground px-1.5 py-0.5 text-xs rounded-sm mt-2">
            {activeLibrary.displayName}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
            <span>docs:</span>
            <div className={cn(switching && "opacity-50 pointer-events-none")}>
              <Select
                value={library}
                onChange={(v) => void handleLibraryChange(v as string)}
              >
                <SelectTrigger
                  className="px-2 py-1 text-xs font-mono w-auto min-w-[120px]"
                  aria-label="Select documentation library"
                >
                  <span>{activeLibrary.displayName}</span>
                </SelectTrigger>
                <SelectContent>
                  {DOCS_LIBRARY_IDS.map((id) => {
                    const config = getDocsLibraryConfig(id)
                    return (
                      <SelectItem key={id} value={id} disabled={!config.enabled}>
                        {config.enabled ? config.displayName : `${config.displayName} (coming soon)`}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </div>
            <span
              className="inline-flex h-4 w-4 items-center justify-center"
              aria-live="polite"
              aria-label={isHeaderBusy ? "Switching docs" : undefined}
            >
              {isHeaderBusy ? <Spinner size="sm" /> : null}
            </span>
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
