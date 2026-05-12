import { CopyButton } from "@/components/copy-button"
import { getConsumptionMetadata, PUBLISH_GATE_NOTE } from "@/lib/consumption-metadata"
import { useLocation } from "@tanstack/react-router"
import type { ConsumptionLibrary, ConsumptionItemKind, ConsumptionMetadata } from "@diffgazer/registry"
import { useComponentData, useHookData } from "../doc-data-context"
import { useCurrentLibrary } from "./use-current-library"

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

function PathRow({ label, path }: { label: string; path: ConsumptionMetadata["paths"]["copy"] }) {
  if (!path.available) {
    return (
      <tr>
        <td className="py-1.5 pr-3 text-xs font-mono text-muted-foreground align-top whitespace-nowrap">{label}</td>
        <td className="py-1.5 text-xs text-muted-foreground italic">{path.note ?? "Not available"}</td>
      </tr>
    )
  }

  return (
    <tr>
      <td className="py-1.5 pr-3 text-xs font-mono text-muted-foreground align-top whitespace-nowrap">{label}</td>
      <td className="py-1.5">
        {path.command && (
          <div className="flex items-center gap-2 border border-border bg-background px-2 py-1 font-mono text-xs rounded">
            <span className="text-muted-foreground select-none">$</span>
            <span className="flex-1 break-all">{path.command}</span>
            <CopyButton text={path.command} />
          </div>
        )}
        {path.note && <p className="text-[11px] text-muted-foreground mt-1">{path.note}</p>}
      </td>
    </tr>
  )
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-[11px]">
      <dt className="font-mono text-muted-foreground">{label}</dt>
      <dd className="font-mono text-foreground break-all">{value}</dd>
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

  return (
    <div className="space-y-3">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="pb-1.5 text-left text-xs font-bold text-foreground">Path</th>
            <th className="pb-1.5 text-left text-xs font-bold text-foreground">Install</th>
          </tr>
        </thead>
        <tbody>
          <PathRow label="Manual copy / shadcn" path={meta.paths.copy} />
          <PathRow label="dgadd" path={meta.paths.dgadd} />
          <PathRow label="npm package" path={meta.paths.package} />
        </tbody>
      </table>

      <dl className="space-y-1">
        {meta.paths.copy.available && meta.copyPath && (
          <DetailRow label="Copy target" value={meta.copyPath} />
        )}
        {meta.paths.dgadd.available && (
          <DetailRow label="dgadd item" value={meta.dgaddName} />
        )}
        {meta.packageImport && (
          <DetailRow label="Package import" value={meta.packageImport} />
        )}
      </dl>

      {meta.publishGated && (
        <p className="text-[11px] text-muted-foreground">{PUBLISH_GATE_NOTE}</p>
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
