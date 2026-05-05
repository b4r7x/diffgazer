import type { Plugin, ViteDevServer } from "vite"
import { exec } from "node:child_process"
import { resolve } from "node:path"
import { getLibrariesWithArtifacts } from "./src/lib/docs-library"

export function docsDataRebuild(): Plugin {
  const APP_ROOT = resolve(import.meta.dirname)
  const WORKSPACE_ROOT = resolve(APP_ROOT, "../../..")
  const IS_DEV = Boolean(process.env.DIFFGAZER_DEV)
  const isVitest = Boolean(process.env.VITEST)
  let server: ViteDevServer
  let rebuilding = false
  let pendingRebuild = false

  function runBuild() {
    if (rebuilding) {
      pendingRebuild = true
      return
    }
    rebuilding = true
    const start = Date.now()
    server.config.logger.info("[docs-data] Rebuilding...", { timestamp: true })

    exec("pnpm prepare:generated", { cwd: APP_ROOT }, (error, _stdout, stderr) => {
      rebuilding = false
      if (error) {
        server.config.logger.error(`[docs-data] Build failed: ${stderr}`)
      } else {
        const elapsed = Date.now() - start
        server.config.logger.info(
          `[docs-data] Rebuilt in ${elapsed}ms`,
          { timestamp: true }
        )
        server.ws.send({ type: "full-reload" })
      }
      if (pendingRebuild) {
        pendingRebuild = false
        runBuild()
      }
    })
  }

  return {
    name: "docs-data-rebuild",
    apply: "serve",
    configureServer(s) {
      if (isVitest) return
      server = s

      let timer: ReturnType<typeof setTimeout> | null = null

      // Only watch workspace artifact dirs in dev mode
      if (!IS_DEV) return

      const watchPaths = getLibrariesWithArtifacts().map((lib) =>
        resolve(WORKSPACE_ROOT, lib.artifactSource.workspaceDir, "dist/artifacts"),
      )

      for (const dir of watchPaths) {
        server.watcher.add(dir)
      }

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
