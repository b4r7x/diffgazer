import { SectionHeader } from "@/components/ui/section-header/section-header"
import type { AnatomyNode } from "@/types/docs-data"

interface AnatomyDiagramProps {
  nodes: AnatomyNode[]
}

export function AnatomyDiagram({ nodes }: AnatomyDiagramProps) {
  if (nodes.length === 0) return null

  return (
    <div className="mb-8">
      <SectionHeader as="h3">Anatomy</SectionHeader>

      <div className="border border-border bg-background p-4 font-mono text-xs">
        {nodes.map((node, i) => (
          <div key={i} className="flex">
            <span
              className="text-success shrink-0"
              style={{ paddingLeft: `${node.indent * 1.5}rem` }}
            >
              {"<"}{node.name}{">"}
            </span>
            {node.note && (
              <span className="ml-4 text-muted-foreground before:content-['←_']">
                {node.note}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
