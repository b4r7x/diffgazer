import { defineConfig } from 'vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import { resolve } from 'path'
import mdx from 'fumadocs-mdx/vite'
import * as MdxConfig from './source.config'

import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'
import { docsDataRebuild } from './vite-plugin-docs-rebuild'
import { getPreRenderPages as enumeratePreRenderPages } from './scripts/generate-sitemap.mjs'
import type { PluginOption } from 'vite'

function getPreRenderPages(): Array<{ path: string }> {
  return enumeratePreRenderPages().map(({ path }) => ({ path }))
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
    test: isVitest
      ? {
          typecheck: {
            enabled: false,
            tsconfig: "./tsconfig.test.json",
            include: ["src/**/*.test.ts", "src/**/*.test.tsx", "scripts/**/*.test.ts"],
          },
        }
      : undefined,
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
      noExternal: ['@diffgazer/keys'],
    },
    resolve: {
      alias: {
        "@/components/ui": resolve(import.meta.dirname, "registry/ui"),
        "@/hooks": resolve(import.meta.dirname, "registry/hooks"),
        "@/lib/aria-utils": resolve(import.meta.dirname, "registry/lib/aria-utils"),
        "@/lib/compose-refs": resolve(import.meta.dirname, "registry/lib/compose-refs"),
        "@/lib/selectable-collection": resolve(import.meta.dirname, "registry/lib/selectable-collection"),
        "@/lib/selectable-variants": resolve(import.meta.dirname, "registry/lib/selectable-variants"),
        "@/lib/input-variants": resolve(import.meta.dirname, "registry/lib/input-variants"),
        "@/lib/resolve-tab-target": resolve(import.meta.dirname, "registry/lib/resolve-tab-target"),
        "@/lib/search": resolve(import.meta.dirname, "registry/lib/search"),
        "@/lib/step-status": resolve(import.meta.dirname, "registry/lib/step-status"),
        "@/lib/focus": resolve(import.meta.dirname, "registry/lib/focus"),
        "@/lib/typeahead": resolve(import.meta.dirname, "registry/lib/typeahead"),
        "@/lib/utils": resolve(import.meta.dirname, "registry/lib/utils"),
        "@/lib/diff": resolve(import.meta.dirname, "registry/lib/diff"),
        "@diffgazer/keys": resolve(import.meta.dirname, "../../libs/keys/src"),
        "@diffgazer/registry": resolve(import.meta.dirname, "../../libs/registry/src"),
        "@": resolve(import.meta.dirname, "./src"),
      },
      dedupe: ["react", "react-dom"],
    },
    plugins,
  }
})

export default config
