import { useComponentData } from "../doc-data-context"
import { DemoPreview } from "@/components/demo-preview"
import { useDemos } from "@/lib/use-demos"
import { useCurrentLibrary } from "./use-current-library"

export function KeyboardNav() {
  const data = useComponentData()
  const library = useCurrentLibrary()
  const demos = useDemos(library)

  if (!data?.docs?.keyboard) return null
  const { description, examples } = data.docs.keyboard

  return (
    <div>
      <h3 className="font-bold text-sm text-foreground mb-3">Keyboard Navigation</h3>
      <p className="text-sm text-muted-foreground mb-4">{description}</p>
      {examples.length > 0 && (
        <div className="space-y-6">
          {examples.map((ex) => (
            <DemoPreview
              key={ex.name}
              title={ex.title}
              demo={demos[ex.name] ?? null}
              code={data.exampleSource[ex.name]?.highlighted ?? []}
              rawCode={data.exampleSource[ex.name]?.raw ?? ""}
            />
          ))}
        </div>
      )}
    </div>
  )
}
