import { useState, useEffect } from "react"
import { demoLoaders, type DemoMap } from "@/generated/demo-loaders"

export type { DemoMap }

export function useDemos(libraryId: string): DemoMap {
  const [demos, setDemos] = useState<DemoMap>({})

  useEffect(() => {
    const loader = demoLoaders[libraryId]
    if (loader) loader().then((m) => setDemos(m.demos))
  }, [libraryId])

  return demos
}
