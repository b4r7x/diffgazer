import { useState } from "react"
import { useLocation, useNavigate } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { Logo } from "@/components/ui/logo/logo"
import { Spinner } from "@/components/ui/spinner/spinner"
import { Divider } from "@/components/ui/divider/divider"
import { Breadcrumbs } from "@/components/breadcrumbs"
import { useSearchOpen } from "@/features/search/search-context"
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

export function Header({ library }: HeaderProps) {
  const { setOpen } = useSearchOpen()
  const pathname = useLocation({ select: (location) => location.pathname })
  const navigate = useNavigate()
  const [switching, setSwitching] = useState(false)
  const activeLibrary = getDocsLibraryConfig(library)

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
    <header className="shrink-0 bg-background z-20 flex flex-col border-b border-border" aria-busy={switching}>
      <div className="px-6 h-24 flex justify-between items-center w-full">
        <div className="flex items-start gap-2 mt-2">
          {switching ? (
            <Spinner size="sm" className="mt-4" />
          ) : (
            <Logo text={activeLibrary.logoText} className="text-foreground text-[6px] sm:text-[8px]" />
          )}
          <span className="bg-border text-foreground px-1.5 py-0.5 text-xs rounded-sm mt-2">
            {activeLibrary.displayName}
          </span>
        </div>

        <div className="flex items-center gap-4">
          <label className="text-xs text-muted-foreground font-mono flex items-center gap-2">
            <span>docs:</span>
            <select
              className="bg-background border border-border px-2 py-1 rounded-sm text-foreground text-xs font-mono"
              value={library}
              onChange={(event) => void handleLibraryChange(event.target.value)}
              disabled={switching}
              aria-label="Select documentation library"
            >
              {DOCS_LIBRARY_IDS.map((id) => {
                const config = getDocsLibraryConfig(id)
                const label = config.enabled
                  ? config.displayName
                  : `${config.displayName} (coming soon)`
                return (
                  <option key={id} value={id} disabled={!config.enabled}>
                    {label}
                  </option>
                )
              })}
            </select>
          </label>

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
