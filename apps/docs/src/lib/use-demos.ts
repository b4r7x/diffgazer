import { useState, useEffect } from "react"
import { demoLoaders, type DemoMap } from "@/generated/demo-loaders"

export type { DemoMap }

const EMPTY_DEMOS: DemoMap = {}

export function useDemos(libraryId: string): DemoMap {
  const [demos, setDemos] = useState<DemoMap>(EMPTY_DEMOS)

  useEffect(() => {
    let active = true
    const loader = demoLoaders[libraryId]

    setDemos(EMPTY_DEMOS)
    if (!loader) return

    loader()
      .then((m) => {
        if (active) setDemos(m.demos)
      })
      .catch((err) => {
        if (!active) return
        if (import.meta.env.DEV) console.warn("Failed to load demos:", err)
        setDemos(EMPTY_DEMOS)
      })

    return () => {
      active = false
    }
  }, [libraryId])

  return demos
}
