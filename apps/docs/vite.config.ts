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
import type { PluginOption } from 'vite'

const KEYSCOPE_ENTRY = resolve(import.meta.dirname, "../../../keyscope/src/index.ts")

function getPreRenderPages(): Array<{ path: string }> {
  const pages: Array<{ path: string }> = [
    { path: '/' },
    { path: '/docs' },
    { path: '/diff-ui/docs' },
    { path: '/keyscope/docs' },
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

        if (rel.startsWith('keyscope/')) {
          const keyscopeRel = rel
            .slice('keyscope/'.length)
            .replace(/\/index$/, '')
          if (keyscopeRel.length > 0) {
            pages.push({ path: `/keyscope/docs/${keyscopeRel}` })
          }
          continue
        }

        const diffUiRel = rel.replace(/\/index$/, '')
        pages.push({ path: `/diff-ui/docs/${diffUiRel}` })
      }
    }
  }
  walkMdx(contentDir)

  const registry = JSON.parse(
    readFileSync(resolve(import.meta.dirname, "registry/registry.json"), "utf-8"),
  )
  for (const item of registry.items) {
    pages.push({ path: `/diff-ui/docs/components/${item.name}` })
  }

  return pages
}

const config = defineConfig(() => {
  const isVitest = Boolean(process.env.VITEST)

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
            enabled: true,
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
        keyscope: KEYSCOPE_ENTRY,
        "@/components/ui": resolve(import.meta.dirname, "registry/ui"),
        "@/hooks": resolve(import.meta.dirname, "registry/hooks"),
        "@": resolve(import.meta.dirname, "./src"),
      },
      dedupe: ["react", "react-dom"],
    },
    plugins,
  }
})

export default config
