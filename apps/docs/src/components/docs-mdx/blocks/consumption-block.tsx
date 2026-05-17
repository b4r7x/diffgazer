import { CopyButton } from "@/components/copy-button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { getConsumptionMetadata } from "@/lib/consumption-metadata"
import { useLocation } from "@tanstack/react-router"
import type { ConsumptionLibrary, ConsumptionItemKind, ConsumptionMetadata } from "@diffgazer/registry"
import { useComponentData, useHookData } from "../doc-data-context"
import { useCurrentLibrary } from "./use-current-library"

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
    <div className="flex items-center gap-2 border border-border bg-background px-2 py-1 font-mono text-xs rounded">
      <span className="text-muted-foreground select-none">$</span>
      <span className="flex-1 break-all">{command}</span>
      <CopyButton text={command} />
    </div>
  )
}

function Captions({ items }: { items: Caption[] }) {
  const visible = items.filter((item): item is Required<Caption> => Boolean(item.value))
  if (visible.length === 0) return null
  return (
    <dl className="space-y-1">
      {visible.map(({ label, value }) => (
        <div key={label} className="flex flex-wrap items-baseline gap-x-2 text-[11px]">
          <dt className="font-mono text-muted-foreground">{label}</dt>
          <dd className="font-mono text-foreground break-all">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function PathBody({ path, captions }: { path: PathState; captions: Caption[] }) {
  if (!path.available) {
    return <p className="text-xs text-muted-foreground italic">{path.note ?? "Not available"}</p>
  }

  return (
    <div className="space-y-2">
      {path.command && <CommandBox command={path.command} />}
      <Captions items={captions} />
      {path.note && <p className="text-[11px] text-muted-foreground">{path.note}</p>}
    </div>
  )
}

export function ConsumptionBlock() {
  const componentData = useComponentData()
  const hookData = useHookData()
  const library = useCurrentLibrary()
  const pathname = useLocation({ select: (location) => location.pathname })

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
    <div className="space-y-4">
      {firstAvailable ? (
        <Tabs defaultValue={firstAvailable.value}>
          <TabsList>
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
        <p className="text-[11px] text-muted-foreground">{meta.cssNote}</p>
      )}

      {library === "keys" && (
        <p className="text-[11px] text-muted-foreground">
          @diffgazer/keys requires no CSS or Tailwind setup.
        </p>
      )}
    </div>
  )
}
