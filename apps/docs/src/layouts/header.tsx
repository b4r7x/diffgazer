import { useState } from "react"
import { useLocation, useNavigate } from "@tanstack/react-router"
import { createServerFn } from "@tanstack/react-start"
import { Logo } from "@/components/ui/logo/logo"
import { LOGO_ASCII } from "@/generated/logo-ascii"
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
import { Kbd } from "@/components/ui/kbd/kbd"
import { cn } from "@diffgazer/ui/lib/utils"
import {
  DOCS_LIBRARY_IDS,
  getDocsLibraryConfig,
  getRouteSlugsFromPathname,
  isDocsLibraryId,
  routeSlugsFromSourcePath,
  sourceSlugsForLibrary,
  type DocsLibraryId,
} from "@/lib/docs-library"
import { usePendingDocsRoute } from "@/lib/hooks/use-pending-docs-route"

const resolveLibrarySwitchPath = createServerFn({ method: "GET" })
  .inputValidator((input: { targetLibrary: DocsLibraryId; currentSlugs: string[] }) => input)
  .handler(async ({ data }) => {
    const { source } = await import("@/lib/source")
    const sourceSlugs = sourceSlugsForLibrary(data.targetLibrary, data.currentSlugs)
    const targetPage = source.getPage(sourceSlugs)

    if (!targetPage) {
      return { library: data.targetLibrary, slugs: [] as string[] }
    }

    const targetSlugs = routeSlugsFromSourcePath(data.targetLibrary, targetPage.path)

    return { library: data.targetLibrary, slugs: targetSlugs ?? [] }
  })

interface HeaderProps {
  library: DocsLibraryId
}

export function Header({ library }: HeaderProps) {
  const { setOpen } = useSearchOpen()
  const pathname = useLocation({ select: (location) => location.pathname })
  const pendingDocsPathname = usePendingDocsRoute()
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
      const { library: targetLib, slugs } = await resolveLibrarySwitchPath({
        data: {
          targetLibrary: nextValue,
          currentSlugs,
        },
      })

      await navigate({
        to: "/$lib/docs/$",
        params: { lib: targetLib, _splat: slugs.join("/") },
      })
    } finally {
      setSwitching(false)
    }
  }

  return (
    <header className="shrink-0 bg-background z-20 flex border-b border-border" aria-busy={isHeaderBusy}>
      <div className="px-6 h-14 flex justify-between items-center w-full">
        <div className="flex items-center gap-2">
          <Logo
            text={activeLibrary.logoText}
            asciiText={LOGO_ASCII[library]}
            className="text-foreground text-[5px] transition-opacity duration-150"
          />
          <Divider orientation="vertical" className="h-4 mx-2" />
          <Breadcrumbs />
        </div>

        <div className="flex items-center gap-5">
          <Select value={library} onChange={(v) => void handleLibraryChange(v)}>
            <SelectTrigger
              className={cn(
                "border-0 bg-transparent hover:bg-transparent rounded-none border-b border-transparent hover:border-muted-foreground px-1 py-1 text-xs font-mono w-auto",
                switching && "opacity-50 pointer-events-none"
              )}
              aria-label="Select documentation library"
            >
              <span className="truncate">{activeLibrary.displayName}</span>
              {isHeaderBusy && <Spinner size="sm" className="ml-2 text-muted-foreground" />}
            </SelectTrigger>
            <SelectContent className="min-w-[200px]">
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

          <a
            href={activeLibrary.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
            aria-label="GitHub repository"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
          </a>

          <button
            className="flex items-center gap-2 bg-transparent border border-border px-3 py-1.5 rounded-sm text-xs min-w-[180px] hover:border-muted-foreground transition-colors cursor-text"
            onClick={() => setOpen(true)}
            aria-label="Search documentation"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-muted-foreground/70 shrink-0" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.3-4.3"/>
            </svg>
            <span className="text-muted-foreground/70 flex-1 text-left">Search docs...</span>
            <Kbd size="sm" className="text-muted-foreground/50">/</Kbd>
          </button>
        </div>
      </div>
    </header>
  )
}
