import {
  REGISTRY_ORIGIN,
  type ConsumptionMetadata,
  type ConsumptionLibrary,
  type ConsumptionItemKind,
} from "@diffgazer/registry"

/** Keys hooks that require KeyboardProvider and are only available through the npm package. */
const KEYS_PACKAGE_ONLY = new Set([
  "use-key",
  "use-scope",
  "use-scoped-navigation",
  "use-focus-zone",
  "use-action-row-navigation",
  "keyboard-provider",
  "use-keyboard-context",
  "use-optional-keyboard-context",
])

/** All packages are publish-gated as of the current date. */
export const PUBLISH_GATED = true

export const PUBLISH_GATE_NOTE =
  "Public npm commands are publish-gated until npm view returns versions for @diffgazer/add, @diffgazer/ui, and @diffgazer/keys."

function getKeysHookFileName(itemId: string): string {
  return itemId.startsWith("use-") ? itemId : `use-${itemId}`
}

function getKeysRegistryItemId(itemId: string): string {
  return itemId.startsWith("use-") ? itemId.slice(4) : itemId
}

function getUiPackageSubpath(itemKind: ConsumptionItemKind): "components" | "hooks" | "lib" {
  if (itemKind === "component") return "components"
  if (itemKind === "hook") return "hooks"
  return "lib"
}

function getUiCopyPath(itemId: string, itemKind: ConsumptionItemKind): string {
  if (itemKind === "component") return `components/${itemId}`
  if (itemKind === "hook") return `hooks/use-${itemId}.ts`
  return `lib/${itemId}.ts`
}

export function getConsumptionMetadata(
  library: ConsumptionLibrary,
  itemId: string,
  itemKind: ConsumptionItemKind,
): ConsumptionMetadata {
  const isKeysPackageOnly = library === "keys" && KEYS_PACKAGE_ONLY.has(itemId)

  if (library === "keys") {
    const registryItemId = getKeysRegistryItemId(itemId)
    const dgaddName = `${library}/${registryItemId}`
    const packageImport = `@diffgazer/keys`
    const copyPath = itemKind === "hook" ? `src/hooks/${getKeysHookFileName(itemId)}.ts` : undefined

    return {
      library,
      itemId,
      itemKind,
      packageImport,
      copyPath,
      dgaddName,
      publishGated: PUBLISH_GATED,
      paths: {
        copy: isKeysPackageOnly
          ? { available: false, note: "Requires KeyboardProvider; package-only." }
          : { available: true, command: `npx shadcn add ${REGISTRY_ORIGIN}/r/keys/${registryItemId}.json` },
        dgadd: isKeysPackageOnly
          ? { available: false, note: "Requires KeyboardProvider; package-only." }
          : {
              available: true,
              command: `pnpm exec dgadd add ${dgaddName}`,
              note: PUBLISH_GATED ? PUBLISH_GATE_NOTE : undefined,
            },
        package: {
          available: true,
          command: `npm install @diffgazer/keys`,
          note: PUBLISH_GATED ? PUBLISH_GATE_NOTE : undefined,
        },
      },
    }
  }

  // library === "ui"
  const dgaddName = `${library}/${itemId}`
  const subpathKind = getUiPackageSubpath(itemKind)
  const packageImport = `@diffgazer/ui/${subpathKind}/${itemId}`

  return {
    library,
    itemId,
    itemKind,
    packageImport,
    copyPath: getUiCopyPath(itemId, itemKind),
    dgaddName,
    publishGated: PUBLISH_GATED,
    paths: {
      copy: {
        available: true,
        command: `npx shadcn add ${REGISTRY_ORIGIN}/r/ui/${itemId}.json`,
      },
      dgadd: {
        available: true,
        command: `pnpm exec dgadd add ui/${itemId}`,
        note: PUBLISH_GATED ? PUBLISH_GATE_NOTE : undefined,
      },
      package: {
        available: true,
        command: `npm install @diffgazer/ui @diffgazer/keys`,
        note: PUBLISH_GATED ? PUBLISH_GATE_NOTE : undefined,
      },
    },
    cssNote: "UI components require Tailwind CSS v4. Copy mode imports src/styles/styles.css; package mode imports @diffgazer/ui/sources.css and @diffgazer/ui/styles.css.",
  }
}
