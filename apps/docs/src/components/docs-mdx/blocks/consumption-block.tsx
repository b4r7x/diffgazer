import { CopyButton } from "@/components/copy-button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { getConsumptionMetadata } from "@/lib/consumption-metadata"
import { useLocation } from "@tanstack/react-router"
import type { ConsumptionLibrary, ConsumptionItemKind, ConsumptionMetadata } from "@diffgazer/registry"
import { getDocsLibraryFromPathname, PRIMARY_DOCS_LIBRARY_ID } from "@/lib/docs-library"
import { useComponentData, useHookData } from "../doc-data-context"

type PathState = ConsumptionMetadata["paths"]["copy"]
type Caption = { label: string; value?: string }

function getRouteItem(pathname: string, library: ConsumptionLibrary): { section: string; itemId: string } | null {
  const segments = pathname.split("/").filter(Boolean)
  if (segments[0] !== library || segments[1] !== "docs") return null

  const section = segments[2]
  const itemId = segments[3]
  if (!section || !itemId) return null

  return { section, itemId }
}

function inferItemKind(library: ConsumptionLibrary, name: string, section?: string): ConsumptionItemKind {
  if (section === "components") return "component"
  if (section === "hooks") return "hook"
  if (section === "utils") return "lib"
  if (library === "keys") return "hook"
  if (name.startsWith("use-")) return "hook"
  return "component"
}

function CommandBox({ command }: { command: string }) {
  return (
    <div className="flex items-center gap-3 border border-border bg-secondary/20 px-3.5 py-2.5 font-mono text-sm">
      <span className="text-muted-foreground select-none">$</span>
      <span className="flex-1 break-all text-foreground">{command}</span>
      <CopyButton text={command} />
    </div>
  )
}

function Captions({ items }: { items: Caption[] }) {
  const visible = items.filter((item): item is Required<Caption> => Boolean(item.value))
  if (visible.length === 0) return null
  return (
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1.5 text-xs font-mono leading-relaxed">
      {visible.map(({ label, value }) => (
        <span key={label} className="inline-flex items-baseline gap-2">
          <span className="text-muted-foreground">
            [<span className="px-1 lowercase">{label}</span>]
          </span>
          <span className="text-foreground font-medium break-all">{value}</span>
        </span>
      ))}
    </div>
  )
}

function PathBody({ path, captions }: { path: PathState; captions: Caption[] }) {
  if (!path.available) {
    return <p className="text-xs text-muted-foreground italic">{path.note ?? "Not available"}</p>
  }

  return (
    <div className="space-y-4">
      {path.command && <CommandBox command={path.command} />}
      <Captions items={captions} />
      {path.note && <p className="text-xs text-muted-foreground leading-relaxed">{path.note}</p>}
    </div>
  )
}

export function ConsumptionBlock() {
  const componentData = useComponentData()
  const hookData = useHookData()
  const pathname = useLocation({ select: (location) => location.pathname })
  const library = getDocsLibraryFromPathname(pathname) ?? PRIMARY_DOCS_LIBRARY_ID

  if (library !== "ui" && library !== "keys") return null

  const routeItem = getRouteItem(pathname, library)
  const itemId = componentData?.name ?? hookData?.name ?? routeItem?.itemId
  if (!itemId) return null

  const itemKind = inferItemKind(library, itemId, routeItem?.section)
  const meta = getConsumptionMetadata(library, itemId, itemKind)

  const localDestination = meta.paths.copy.available ? meta.copyPath : undefined

  const tabs: { value: string; label: string; path: PathState; captions: Caption[] }[] = [
    {
      value: "dgadd",
      label: "dgadd",
      path: meta.paths.dgadd,
      captions: [
        { label: "Installs to", value: localDestination },
        { label: "Item", value: meta.dgaddName },
      ],
    },
    {
      value: "shadcn",
      label: "shadcn CLI",
      path: meta.paths.copy,
      captions: [
        { label: "Copies to", value: localDestination },
      ],
    },
    {
      value: "package",
      label: "npm package",
      path: meta.paths.package,
      captions: [
        { label: "Import", value: meta.packageImport },
      ],
    },
  ]

  const firstAvailable = tabs.find((t) => t.path.available)

  return (
    <div className="space-y-5">
      {firstAvailable ? (
        <Tabs defaultValue={firstAvailable.value} variant="underline" size="sm">
          <TabsList className="mb-4">
            {tabs.map((t) => (
              <TabsTrigger key={t.value} value={t.value} disabled={!t.path.available}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((t) => (
            <TabsContent key={t.value} value={t.value}>
              <PathBody path={t.path} captions={t.captions} />
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <p className="text-xs text-muted-foreground italic">Not available</p>
      )}

      {meta.cssNote && library === "ui" && (
        <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/40 pt-3">{meta.cssNote}</p>
      )}

      {library === "keys" && (
        <p className="text-xs text-muted-foreground leading-relaxed border-t border-border/40 pt-3">
          @diffgazer/keys requires no CSS or Tailwind setup.
        </p>
      )}
    </div>
  )
}
