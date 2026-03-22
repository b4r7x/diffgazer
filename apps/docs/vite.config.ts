import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import { resolve, join, relative } from 'path'
import { readdirSync, readFileSync } from 'fs'
import mdx from 'fumadocs-mdx/vite'
import * as MdxConfig from './source.config'

import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import { docsDataRebuild } from './vite-plugin-docs-rebuild'
import { getEnabledDocsLibraries } from './src/lib/docs-library'
import type { PluginOption } from 'vite'

function getPreRenderPages(): Array<{ path: string }> {
  const enabledLibraries = getEnabledDocsLibraries()
  const pages: Array<{ path: string }> = [
    { path: '/' },
    { path: '/docs' },
    ...enabledLibraries.map((lib) => ({ path: `/${lib.id}/docs` })),
  ]

  const contentDir = resolve(import.meta.dirname, 'content/docs')
  function walkMdx(dir: string) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) {
        if (entry.name === 'components') continue
        walkMdx(full)
      } else if (entry.name.endsWith('.mdx')) {
        const rel = relative(contentDir, full)
          .replace(/\.mdx$/, '')
        if (rel === 'index') continue

        const lib = enabledLibraries.find((l) => rel.startsWith(`${l.id}/`))
        if (lib) {
          const libRel = rel.slice(`${lib.id}/`.length).replace(/\/index$/, '')
          if (libRel.length > 0) {
            pages.push({ path: `/${lib.id}/docs/${libRel}` })
          }
        }
      }
    }
  }
  walkMdx(contentDir)

  for (const lib of enabledLibraries) {
    try {
      const componentListPath = resolve(import.meta.dirname, `src/generated/${lib.id}/component-list.json`)
      const components = JSON.parse(readFileSync(componentListPath, "utf-8"))
      for (const item of components) {
        pages.push({ path: `/${lib.id}/docs/components/${item.name}` })
      }
    } catch { /* component list not yet built for this library */ }

    try {
      const hookListPath = resolve(import.meta.dirname, `src/generated/${lib.id}/hook-list.json`)
      const hooks = JSON.parse(readFileSync(hookListPath, "utf-8"))
      for (const item of hooks) {
        pages.push({ path: `/${lib.id}/docs/hooks/${item.name}` })
      }
    } catch { /* hook list not yet built for this library */ }
  }

  return pages
}

const config = defineConfig(() => {
  const isVitest = Boolean(process.env.VITEST)
  const prerenderEnabled = !isVitest && process.env.DOCS_PRERENDER !== "0"

  const plugins: PluginOption[] = [
    mdx(MdxConfig),
    viteTsConfigPaths({
      projects: ["./tsconfig.json", "./registry/tsconfig.json"],
    }),
    tailwindcss(),
    docsDataRebuild(),
    !isVitest
      ? tanstackStart({
          prerender: {
            enabled: prerenderEnabled,
            crawlLinks: false,
          },
          pages: getPreRenderPages(),
        })
      : null,
    !isVitest ? nitro() : null,
    viteReact(),
  ]

  return {
    server: {
      port: 3000,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) return 'vendor-react'
            if (id.includes('/node_modules/@tanstack/react-router/')) return 'vendor-router'
          },
        },
      },
    },
    ssr: {
      noExternal: ['keyscope'],
    },
    resolve: {
      alias: {
        "@/components/ui": resolve(import.meta.dirname, "registry/ui"),
        "@/hooks": resolve(import.meta.dirname, "registry/hooks"),
        "@/lib/compose-refs": resolve(import.meta.dirname, "registry/lib/compose-refs"),
        "@/lib/selectable-variants": resolve(import.meta.dirname, "registry/lib/selectable-variants"),
        "@/lib/input-variants": resolve(import.meta.dirname, "registry/lib/input-variants"),
        "@/lib/resolve-tab-target": resolve(import.meta.dirname, "registry/lib/resolve-tab-target"),
        "@/lib/diff-utils": resolve(import.meta.dirname, "registry/lib/diff-utils"),
        "@": resolve(import.meta.dirname, "./src"),
      },
      dedupe: ["react", "react-dom"],
    },
    plugins,
  }
})

export default config
