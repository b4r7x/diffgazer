import { Suspense, type ComponentType, type LazyExoticComponent } from "react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { CodeBlock, CodeBlockContent, CodeBlockHeader, CodeBlockLabel, CodeBlockLine, type CodeBlockLineProps } from "@/components/ui/code-block"
import { CopyButton } from "./copy-button"

interface DemoPreviewProps {
  title?: string
  demo: LazyExoticComponent<ComponentType> | null
  code: CodeBlockLineProps[]
  rawCode: string
  variant?: "tabbed" | "stacked"
}

function PreviewPane({ demo: Demo }: { demo: LazyExoticComponent<ComponentType> | null }) {
  return (
    <div className="border border-border bg-[radial-gradient(#333_1px,transparent_1px)] [background-size:20px_20px] p-12 flex items-center justify-center min-h-[320px] relative">
      <div className="absolute top-0 left-0 px-3 py-1 bg-border/50 text-[10px] text-muted-foreground font-bold uppercase tracking-wider border-b border-r border-border">
        Live Preview
      </div>
      {Demo ? (
        <Suspense fallback={<div className="flex items-center justify-center animate-pulse"><span className="text-muted-foreground text-xs">[loading...]</span></div>}>
          <Demo />
        </Suspense>
      ) : (
        <span className="text-muted-foreground text-xs">[no preview available]</span>
      )}
    </div>
  )
}

function CodePane({ code, rawCode }: { code: CodeBlockLineProps[]; rawCode: string }) {
  return (
    <CodeBlock className="rounded-none">
      <CodeBlockHeader>
        <CodeBlockLabel>tsx</CodeBlockLabel>
        <CopyButton text={rawCode} />
      </CodeBlockHeader>
      <CodeBlockContent>
        {code.map(line => (
          <CodeBlockLine key={line.number} {...line} />
        ))}
      </CodeBlockContent>
    </CodeBlock>
  )
}

export function DemoPreview({ title, demo, code, rawCode, variant = "tabbed" }: DemoPreviewProps) {
  return (
    <div className="mb-6">
      {title && (
        <p className="text-xs font-mono text-muted-foreground mb-2">{title}</p>
      )}
      {variant === "stacked" ? (
        <>
          <CodePane code={code} rawCode={rawCode} />
          <PreviewPane demo={demo} />
        </>
      ) : (
        <Tabs defaultValue="preview">
          <TabsContent value="preview">
            <PreviewPane demo={demo} />
          </TabsContent>
          <TabsContent value="code">
            <CodePane code={code} rawCode={rawCode} />
          </TabsContent>
          <TabsList className="flex mt-2">
            <TabsTrigger value="preview" className="px-4 py-2 text-xs font-mono">
              Preview
            </TabsTrigger>
            <TabsTrigger value="code" className="px-4 py-2 text-xs font-mono">
              Code
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}
    </div>
  )
}
