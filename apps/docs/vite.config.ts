import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import { resolve, join, relative } from 'path'
import { existsSync, readdirSync, readFileSync } from 'fs'
import mdx from 'fumadocs-mdx/vite'
import * as MdxConfig from './source.config'

import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import { docsDataRebuild } from './vite-plugin-docs-rebuild'
import type { PluginOption } from 'vite'

function getPreRenderPages(): Array<{ path: string }> {
  const pages: Array<{ path: string }> = [
    { path: '/' },
    { path: '/docs' },
  ]

  const contentDir = resolve(import.meta.dirname, 'content/generated-docs')
  if (existsSync(contentDir)) {
    function walkMdx(dir: string) {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name)
        if (entry.isDirectory()) {
          if (entry.name === 'components') continue
          walkMdx(full)
        } else if (entry.name.endsWith('.mdx')) {
          const rel = relative(contentDir, full)
            .replace(/\.mdx$/, '')
            .replace(/\/index$/, '')
          if (rel === 'index') continue
          pages.push({ path: `/docs/${rel}` })
        }
      }
    }
    walkMdx(contentDir)
  }

  const registryPath = resolve(import.meta.dirname, './vendor/registry/registry.json')
  if (existsSync(registryPath)) {
    const registry = JSON.parse(readFileSync(registryPath, 'utf-8'))
    for (const item of registry.items) {
      pages.push({ path: `/docs/components/${item.name}` })
    }
  }

  return pages
}

const config = defineConfig(() => {
  const isVitest = Boolean(process.env.VITEST)
  const keyscopeRoot = resolve(import.meta.dirname, './vendor/keyscope/src/index.ts')

  const plugins: PluginOption[] = [
    mdx(MdxConfig),
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
      ignoreConfigErrors: true,
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
      port: 3002,
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
        keyscope: keyscopeRoot,
        '@/components/ui': resolve(import.meta.dirname, './vendor/registry/ui'),
        '@/hooks': resolve(import.meta.dirname, './vendor/registry/hooks'),
        '@': resolve(import.meta.dirname, './src'),
      },
      dedupe: ['react', 'react-dom'],
    },
    plugins,
  }
})

export default config
