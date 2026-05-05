import { useState } from "react"
import { SectionHeader } from "@/components/ui/section-header/section-header"
import { CodeBlock, CodeBlockContent, CodeBlockLine, type CodeBlockLineProps } from "@/components/ui/code-block"
import { CopyButton } from "./copy-button"
import { hooksData } from "@/generated/library-data"

interface HookData {
  name: string
  title: string
  description: string
  source: {
    raw: string
    highlighted: CodeBlockLineProps[]
  }
}

interface HookSourceProps {
  library: string
  hook: string
}

export function HookSource({ library, hook }: HookSourceProps) {
  const data = (hooksData[library] ?? {}) as Record<string, HookData>
  const entry = data[hook]

  if (!entry) return null

  return (
    <div className="space-y-6">
      <HookSourceBlock hook={entry} />
    </div>
  )
}

interface HookSourceAllProps {
  data: Record<string, HookData>
  sectionTitle: string
  hint: React.ReactNode
}

function HookSourceAll({ data, sectionTitle, hint }: HookSourceAllProps) {
  const entries = Object.values(data)

  if (entries.length === 0) return null

  return (
    <div className="space-y-6">
      <SectionHeader as="h3">{sectionTitle}</SectionHeader>
      <p className="text-sm text-muted-foreground">{hint}</p>
      {entries.map((hook) => (
        <HookSourceBlock key={hook.name} hook={hook} />
      ))}
    </div>
  )
}

function HookSourceBlock({ hook }: { hook: HookData }) {
  const [expanded, setExpanded] = useState(false)
  const fileName = `use-${hook.name}.ts`

  return (
    <div className="border border-border rounded-sm overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-secondary/30 border-b border-border">
        <div>
          <button
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            className="flex items-center gap-2 text-sm font-mono text-foreground hover:text-primary transition-colors cursor-pointer"
          >
            <span className="text-muted-foreground">{expanded ? "v" : ">"}</span>
            <span className="font-bold">{fileName}</span>
          </button>
          <p className="text-xs text-muted-foreground mt-0.5 ml-5">
            {hook.description}
          </p>
        </div>
        <CopyButton text={hook.source.raw} label={`Copy ${hook.title}`} />
      </div>
      {expanded && (
        <CodeBlock>
          <CodeBlockContent>
            {hook.source.highlighted.map(line => (
              <CodeBlockLine key={line.number} {...line} />
            ))}
          </CodeBlockContent>
        </CodeBlock>
      )}
    </div>
  )
}

interface LibraryHookSourceProps {
  library: string
  sectionTitle: string
  hint: React.ReactNode
}

export function LibraryHookSource({ library, sectionTitle, hint }: LibraryHookSourceProps) {
  const data = (hooksData[library] ?? {}) as Record<string, HookData>
  return <HookSourceAll data={data} sectionTitle={sectionTitle} hint={hint} />
}
