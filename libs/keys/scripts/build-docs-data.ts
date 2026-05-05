import { resolve } from "node:path"
import {
  buildDocsData,
  createHookDocLoader,
  kebabToCamelCase,
  type HookRegistryItem,
  type RegistryItem,
} from "@diffgazer/registry"

const ROOT = resolve(import.meta.dirname, "..")

function toHookDirName(name: string): string {
  return name.startsWith("use-") ? name : `use-${name}`
}

const loadHookDoc = createHookDocLoader(
  resolve(ROOT, "registry/hook-docs"),
  toHookDirName,
)

const PROVIDER_HOOKS: HookRegistryItem[] = [
  { name: "use-key", title: "useKey", description: "Bind keyboard shortcuts to handlers with scoped, document-level, or element-targeted listening", files: [{ path: "src/hooks/use-key.ts" }] },
  { name: "use-scope", title: "useScope", description: "Push a named scope onto the keyboard scope stack", files: [{ path: "src/hooks/use-scope.ts" }] },
  { name: "use-scoped-navigation", title: "useScopedNavigation", description: "Scope-aware keyboard navigation registered via KeyboardProvider", files: [{ path: "src/hooks/use-scoped-navigation.ts" }] },
  { name: "use-focus-zone", title: "useFocusZone", description: "Manage focus across multiple zones with arrow key and Tab transitions", files: [{ path: "src/hooks/use-focus-zone.ts" }] },
]

buildDocsData({
  libraryId: "keys",
  rootDir: ROOT,
  registryPath: resolve(ROOT, "registry/registry.json"),
  examplesDir: resolve(ROOT, "registry/examples"),
  outputDir: resolve(ROOT, "docs/generated"),
  skipMdxGeneration: true,
  hooks: {
    contentDir: resolve(ROOT, "docs/content/hooks"),
    extraItems: PROVIDER_HOOKS,
    filter: (item) => item.type === "registry:hook" && !item.meta?.hidden,
    mapItem: (item: RegistryItem): HookRegistryItem => ({
      name: toHookDirName(item.name),
      title: kebabToCamelCase(toHookDirName(item.name)),
      description: item.description ?? "",
      files: item.files,
    }),
    loadHookDoc,
    backwardCompatFile: "keys-hooks.json",
  },
  demoIndex: {
    importPathPrefix: "../../../registry/examples/keys",
  },
}).catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exitCode = 1
})
