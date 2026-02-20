import type { Plugin, ViteDevServer } from "vite"
import { exec } from "node:child_process"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

type LibrarySourceRecord = {
  sourceRoot?: unknown
}

function findWatchPaths(appRoot: string): string[] {
  const resolvedPaths = new Set<string>()
  const sourcesPath = resolve(appRoot, "src/generated/library-sources.json")

  if (existsSync(sourcesPath)) {
    try {
      const parsed = JSON.parse(readFileSync(sourcesPath, "utf-8")) as unknown
      if (Array.isArray(parsed)) {
        for (const item of parsed as LibrarySourceRecord[]) {
          if (typeof item.sourceRoot === "string" && existsSync(item.sourceRoot)) {
            resolvedPaths.add(resolve(item.sourceRoot))
          }
        }
      }
    } catch {
      // Ignore malformed cache and rely on fallback paths.
    }
  }

  const fallbackPaths = [
    resolve(appRoot, "../../../diff-ui"),
    resolve(appRoot, "../../../keyscope"),
    resolve(appRoot, "../../../diffgazer-workspace/diff-ui"),
    resolve(appRoot, "../../../diffgazer-workspace/keyscope"),
  ]

  for (const path of fallbackPaths) {
    if (existsSync(path)) {
      resolvedPaths.add(path)
    }
  }

  return [...resolvedPaths]
}

export function docsDataRebuild(): Plugin {
  const APP_ROOT = resolve(import.meta.dirname)
  const isVitest = Boolean(process.env.VITEST)
  let server: ViteDevServer
  let rebuilding = false
  let pendingRebuild = false
  let watchPaths: string[] = []
  const watchedRoots = new Set<string>()

  function syncWatchPaths() {
    watchPaths = findWatchPaths(APP_ROOT)
    for (const dir of watchPaths) {
      if (watchedRoots.has(dir)) continue
      server.watcher.add(dir)
      watchedRoots.add(dir)
    }
  }

  function runBuild() {
    if (rebuilding) {
      pendingRebuild = true
      return
    }

    rebuilding = true
    const start = Date.now()
    server.config.logger.info("[docs-assets] Rebuilding...", { timestamp: true })

    exec("pnpm prepare:assets", { cwd: APP_ROOT }, (error, _stdout, stderr) => {
      rebuilding = false
      if (error) {
        server.config.logger.error(`[docs-assets] Build failed: ${stderr}`)
      } else {
        syncWatchPaths()
        const elapsed = Date.now() - start
        server.config.logger.info(`[docs-assets] Rebuilt in ${elapsed}ms`, { timestamp: true })
        server.ws.send({ type: "full-reload" })
      }

      if (pendingRebuild) {
        pendingRebuild = false
        runBuild()
      }
    })
  }

  return {
    name: "docs-assets-rebuild",
    apply: "serve",
    configureServer(s) {
      if (isVitest) return
      server = s

      let timer: ReturnType<typeof setTimeout> | null = null

      syncWatchPaths()

      server.watcher.on("all", (event, filePath) => {
        const isWatched = watchPaths.some((dir) => filePath.startsWith(dir))
        if (!isWatched) return
        if (!["add", "change", "unlink"].includes(event)) return

        if (timer) clearTimeout(timer)
        timer = setTimeout(runBuild, 300)
      })
    },
  }
}
