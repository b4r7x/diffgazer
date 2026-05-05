import { useDocData } from "../doc-data-context"
import { DemoPreview } from "@/components/demo-preview"
import { useDemos } from "@/lib/use-demos"
import { useCurrentLibrary } from "./use-current-library"

export function Example({ name }: { name: string }) {
  const data = useDocData()
  const library = useCurrentLibrary()
  const demos = useDemos(library)

  if (!data) return null
  const d = data.data
  const src = d.exampleSource?.[name]
  if (!src) return null

  return (
    <DemoPreview
      demo={demos[name] ?? null}
      code={src.highlighted}
      rawCode={src.raw}
    />
  )
}
