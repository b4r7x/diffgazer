import { useState } from "react"
import { SectionHeader } from "@/components/ui/section-header/section-header"
import { CodeBlock } from "@/components/ui/code-block/code-block"
import { CopyButton } from "./copy-button"
import keyscopeHooksData from "@/generated/keyscope-hooks.json"
import diffuiHooksData from "@/generated/diffui-hooks.json"
import type { CodeBlockLine } from "@/components/ui/code-block/code-block"

interface HookData {
  name: string
  title: string
  description: string
  source: {
    raw: string
    highlighted: CodeBlockLine[]
  }
}

interface HookSourceProps {
  data: Record<string, HookData>
  sectionTitle: string
  hint: React.ReactNode
}

export function HookSource({ data, sectionTitle, hint }: HookSourceProps) {
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
        <CodeBlock lines={hook.source.highlighted} />
      )}
    </div>
  )
}

// Pre-configured exports for MDX component registry
export function KeyscopeHookSource() {
  return (
    <HookSource
      data={keyscopeHooksData as Record<string, HookData>}
      sectionTitle="Standalone Hook Source Code"
      hint={
        <>
          Copy these hooks into your project to use them without installing keyscope.
          Place them in your hooks directory (e.g.{" "}
          <code className="text-xs bg-border px-1 rounded">src/hooks/</code>).
        </>
      }
    />
  )
}

export function DiffuiHookSource() {
  return (
    <HookSource
      data={diffuiHooksData as Record<string, HookData>}
      sectionTitle="Utility Hook Source Code"
      hint={
        <>
          Copy these hooks into your project or install via CLI:{" "}
          <code className="text-xs bg-border px-1 rounded">npx diffui add controllable-state</code>
        </>
      }
    />
  )
}
