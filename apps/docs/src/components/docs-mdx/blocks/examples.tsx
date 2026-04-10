import { useDocData } from "../doc-data-context"
import { DemoPreview } from "@/components/demo-preview"
import { CopyButton } from "@/components/copy-button"
import { CodeBlock, CodeBlockContent, CodeBlockLine } from "@/components/ui/code-block"
import { useDemos } from "@/lib/use-demos"
import { resolveExamples } from "@/lib/resolve-examples"
import { useCurrentLibrary } from "./use-current-library"

export function Examples({ skipFirst }: { skipFirst?: boolean }) {
  const data = useDocData()
  const library = useCurrentLibrary()
  const demos = useDemos(library)

  if (!data) return null
  const d = data.data
  const allExamples = resolveExamples(d)
  const examples = skipFirst ? allExamples.slice(1) : allExamples

  if (examples.length === 0) return null

  return (
    <div className="space-y-6">
      {examples.map((ex) => {
        const src = d.exampleSource?.[ex.name]
        if (!src) return null
        const demo = demos[ex.name] ?? null
        if (demo) {
          return (
            <DemoPreview
              key={ex.name}
              title={ex.title}
              demo={demo}
              code={src.highlighted}
              rawCode={src.raw}
              variant="stacked"
            />
          )
        }
        return (
          <div key={ex.name} className="border border-border rounded-sm overflow-hidden">
            <div className="px-3 py-2 bg-secondary/30 border-b border-border flex items-center justify-between">
              <span className="text-xs font-mono text-foreground font-bold">{ex.title}</span>
              <CopyButton text={src.raw} />
            </div>
            <CodeBlock>
              <CodeBlockContent>
                {src.highlighted.map(line => (
                  <CodeBlockLine key={line.number} {...line} />
                ))}
              </CodeBlockContent>
            </CodeBlock>
          </div>
        )
      })}
    </div>
  )
}
