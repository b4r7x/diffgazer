import { SectionHeader } from "@/components/ui/section-header/section-header"
import { CodeBlock, CodeBlockHeader, CodeBlockLabel, CodeBlockContent, CodeBlockLine, type CodeBlockLineProps } from "@/components/ui/code-block"
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion"
import { CopyButton } from "./copy-button"

interface HookParameter {
  name: string
  type: string
  required: boolean
  description: string
  defaultValue?: string
}

export interface HookDocPageProps {
  data: {
    name: string
    title: string
    description: string
    source: { raw: string; highlighted: CodeBlockLineProps[] }
    docs: {
      description?: string
      usage?: { code?: string; example?: string; lang?: string }
      parameters?: HookParameter[]
      returns?: {
        type: string
        description: string
        properties?: HookParameter[]
      }
      notes?: Array<{ title: string; content: string }>
      examples?: Array<{ name: string; title: string }>
      tags?: string[]
    } | null
    usageSnippet?: string
    usageSnippetHighlighted?: CodeBlockLineProps[]
    examples: string[]
    exampleSource: Record<string, { raw: string; highlighted: CodeBlockLineProps[] }>
  }
}

export function HookDocPage({ data }: HookDocPageProps) {
  const docs = data.docs
  const resolvedExamples = resolveExamples(data)

  return (
    <div className="max-w-4xl flex-1 flex flex-col space-y-8" data-pagefind-body>
      {/* Usage */}
      {data.usageSnippetHighlighted && data.usageSnippetHighlighted.length > 0 && (
        <div>
          <SectionHeader as="h2" id="hook-usage" className="scroll-mt-24">
            Usage
          </SectionHeader>
          <CodeBlock>
            <CodeBlockHeader>
              <CodeBlockLabel>{docs?.usage?.lang ?? "tsx"}</CodeBlockLabel>
              {data.usageSnippet ? <CopyButton text={data.usageSnippet} /> : undefined}
            </CodeBlockHeader>
            <CodeBlockContent>
              {data.usageSnippetHighlighted.map(line => (
                <CodeBlockLine key={line.number} {...line} />
              ))}
            </CodeBlockContent>
          </CodeBlock>
        </div>
      )}

      {/* Parameters */}
      {docs?.parameters && docs.parameters.length > 0 && (
        <div>
          <SectionHeader as="h2" id="hook-parameters" className="scroll-mt-24">
            Parameters
          </SectionHeader>
          <ParamTable params={docs.parameters} />
        </div>
      )}

      {/* Returns */}
      {docs?.returns && (
        <div>
          <SectionHeader as="h2" id="hook-returns" className="scroll-mt-24">
            Returns
          </SectionHeader>
          <div className="mb-3">
            <span className="text-sm font-mono text-foreground">{docs.returns.type}</span>
            {docs.returns.description && (
              <span className="text-sm text-muted-foreground"> — {docs.returns.description}</span>
            )}
          </div>
          {docs.returns.properties && docs.returns.properties.length > 0 && (
            <ParamTable params={docs.returns.properties} />
          )}
        </div>
      )}

      {/* Examples */}
      {resolvedExamples.length > 0 && (
        <div>
          <SectionHeader as="h2" id="hook-examples" className="scroll-mt-24">
            Examples
          </SectionHeader>
          <div className="space-y-4">
            {resolvedExamples.map((ex) => {
              const src = data.exampleSource[ex.name]
              if (!src) return null
              return (
                <div key={ex.name} className="border border-border rounded-sm overflow-hidden">
                  <div className="px-3 py-2 bg-secondary/30 border-b border-border flex items-center justify-between">
                    <span className="text-xs font-mono text-foreground font-bold">
                      {ex.title}
                    </span>
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
        </div>
      )}

      {/* Notes */}
      {docs?.notes && docs.notes.length > 0 && (
        <div>
          <SectionHeader as="h2" id="hook-notes" className="scroll-mt-24">
            Notes
          </SectionHeader>
          <div className="space-y-3">
            {docs.notes.map((note, i) => (
              <div
                key={i}
                className="border-l-2 border-border pl-3 py-1"
              >
                <h4 className="text-sm font-bold text-foreground mb-0.5">
                  {note.title}
                </h4>
                <p className="text-sm text-muted-foreground">{note.content}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Source */}
      <div id="hook-source" className="scroll-mt-24">
        <div className="flex items-center justify-between">
          <SectionHeader as="h3">Source</SectionHeader>
          <CopyButton text={data.source.raw} label={`Copy ${data.title}`} />
        </div>
        <Accordion collapsible className="divide-y-0">
          <AccordionItem value="source" className="py-0">
            <AccordionTrigger variant="source">
              View hook source
            </AccordionTrigger>
            <AccordionContent>
              <CodeBlock>
                <CodeBlockContent>
                  {data.source.highlighted.map(line => (
                    <CodeBlockLine key={line.number} {...line} />
                  ))}
                </CodeBlockContent>
              </CodeBlock>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </div>
  )
}

function ParamTable({ params }: { params: HookParameter[] }) {
  return (
    <div>
      {params.map((param, index) => (
        <div key={param.name}>
          {index > 0 && (
            <div className="w-full border-t border-border border-dashed opacity-50" />
          )}
          <div className="py-4">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-base font-bold text-foreground">{param.name}</span>
              <span className="text-xs text-muted-foreground font-mono">: {param.type}</span>
              {param.required && (
                <span className="px-1.5 py-0.5 border border-border text-[10px] text-muted-foreground rounded bg-background font-mono">
                  required
                </span>
              )}
              {param.defaultValue && (
                <span className="px-1.5 py-0.5 border border-border text-[10px] text-muted-foreground rounded bg-background font-mono">
                  default: {param.defaultValue}
                </span>
              )}
            </div>
            {param.description && (
              <p className="text-muted-foreground text-sm max-w-2xl">
                {param.description}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function resolveExamples(
  data: HookDocPageProps["data"]
): Array<{ name: string; title: string }> {
  if (data.docs?.examples && data.docs.examples.length > 0) {
    return data.docs.examples
  }
  return data.examples.map((name) => ({
    name,
    title: name
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase()),
  }))
}
