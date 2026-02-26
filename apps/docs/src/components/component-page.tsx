import { Link, useLocation, useNavigate } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import type { ComponentData, ExampleRef } from "@/types/docs-data"
import { demos } from "@/generated/diff-ui/demo-index"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { DemoPreview } from "./demo-preview"
import { PropsTable } from "./props-table"
import { SourceViewer } from "./source-viewer"
import { AnatomyDiagram } from "./anatomy-diagram"
import { CopyButton } from "./copy-button"
import { Pager, PagerPrevious, PagerNext } from "@/components/ui/pager"
import { CodeBlock } from "@/components/ui/code-block/code-block"
import { getDocsLibraryFromPathname } from "@/lib/docs-library"

interface ComponentPageProps {
  data: ComponentData
  prev: string | null
  next: string | null
}

type ComponentPageTab = "usage" | "examples" | "api" | "accessibility"

const SECTION_TO_TAB: Partial<Record<string, ComponentPageTab>> = {
  "component-installation": "usage",
  "component-usage": "usage",
  "component-examples": "examples",
  "component-api": "api",
  "component-accessibility": "accessibility",
}

const TAB_TO_SECTION: Record<ComponentPageTab, string> = {
  usage: "component-usage",
  examples: "component-examples",
  api: "component-api",
  accessibility: "component-accessibility",
}

function parseHashId(hash: string): string | null {
  if (!hash || hash.length === 0) return null
  const raw = hash.startsWith("#") ? hash.slice(1) : hash
  if (!raw) return null
  try {
    return decodeURIComponent(raw)
  } catch {
    return raw
  }
}

export function getTabFromHash(hash: string): ComponentPageTab | null {
  const id = parseHashId(hash)
  if (!id) return null
  return SECTION_TO_TAB[id] ?? null
}

export function ComponentPage({ data, prev, next }: ComponentPageProps) {
  const hash = useLocation({ select: (location) => location.hash })
  const pathname = useLocation({ select: (location) => location.pathname })
  const navigate = useNavigate()
  const library = getDocsLibraryFromPathname(pathname) ?? "diff-ui"
  const examples = resolveExamples(data)
  const [heroExample] = examples
  const [activeTab, setActiveTab] = useState<ComponentPageTab>("usage")
  const installCommand = `npx diffui add ${data.name}`
  const sourceFiles = Object.entries(data.source).map(([path, file]) => ({
    path,
    raw: file.raw,
    highlighted: file.highlighted,
  }))

  useEffect(() => {
    const tabFromHash = getTabFromHash(hash)
    const nextTab = tabFromHash ?? "usage"
    setActiveTab((previous) => (previous === nextTab ? previous : nextTab))
  }, [hash, data.name])

  const handleTabChange = (tab: ComponentPageTab) => {
    setActiveTab(tab)
    navigate({
      to: ".",
      hash: TAB_TO_SECTION[tab],
      replace: true,
      resetScroll: false,
      hashScrollIntoView: false,
    })
  }

  return (
    <div className="max-w-4xl flex-1 flex flex-col" data-pagefind-body>
      <Tabs<ComponentPageTab>
        value={activeTab}
        onChange={handleTabChange}
        variant="underline"
        className="mb-8"
      >
        <TabsList>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="examples">Examples</TabsTrigger>
          <TabsTrigger value="api">API</TabsTrigger>
          <TabsTrigger value="accessibility">Accessibility</TabsTrigger>
        </TabsList>

        <TabsContent value="usage" className="mt-6 space-y-8">
          {heroExample && (
            <DemoPreview
              demo={demos[heroExample.name] ?? null}
              code={data.exampleSource[heroExample.name]?.highlighted ?? []}
              rawCode={data.exampleSource[heroExample.name]?.raw ?? ""}
            />
          )}

          <div>
            <h3 id="component-installation" className="font-bold text-sm text-foreground mb-3 scroll-mt-24">
              Installation
            </h3>
            <div className="flex items-center gap-2 border border-border bg-background p-3 font-mono text-xs rounded-lg">
              <span className="text-muted-foreground select-none">$</span>
              <span className="flex-1">{installCommand}</span>
              <CopyButton text={installCommand} />
            </div>
          </div>

          <div>
            <h3 id="component-usage" className="font-bold text-sm text-foreground mb-3 scroll-mt-24">
              Usage
            </h3>
            <CodeBlock
              label="tsx"
              lines={data.usageSnippetHighlighted}
              headerAction={<CopyButton text={data.usageSnippet} />}
            />
          </div>
        </TabsContent>

        <TabsContent value="examples" className="mt-6 space-y-6">
          <div id="component-examples" className="h-px scroll-mt-24" aria-hidden />
          {examples.length > 0 ? (
            examples.map((ex) => (
              <DemoPreview
                key={ex.name}
                title={ex.title}
                demo={demos[ex.name] ?? null}
                code={data.exampleSource[ex.name]?.highlighted ?? []}
                rawCode={data.exampleSource[ex.name]?.raw ?? ""}
                variant="stacked"
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No examples available.</p>
          )}
        </TabsContent>

        <TabsContent value="api" className="mt-6 space-y-8">
          <div id="component-api" className="h-px scroll-mt-24" aria-hidden />
          {Object.keys(data.props).length > 0 ? (
            Object.entries(data.props).map(([componentName, props]) => (
              <PropsTable
                key={componentName}
                componentName={componentName}
                props={props}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No API documentation available.</p>
          )}
        </TabsContent>

        <TabsContent value="accessibility" className="mt-6 space-y-8">
          <div id="component-accessibility" className="h-px scroll-mt-24" aria-hidden />
          {data.docs?.anatomy && data.docs.anatomy.length > 0 && (
            <AnatomyDiagram nodes={data.docs.anatomy} />
          )}

          {data.docs?.keyboard && (
            <div>
              <h3 className="font-bold text-sm text-foreground mb-3">Keyboard Navigation</h3>
              <p className="text-sm text-muted-foreground mb-4">
                {data.docs.keyboard.description}
              </p>
              {data.docs.keyboard.examples.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {data.docs.keyboard.examples.map((ex) => (
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
          )}

          {data.docs?.notes && data.docs.notes.length > 0 && (
            <div>
              <h3 className="font-bold text-sm text-foreground mb-3">Notes</h3>
              {data.docs.notes.map((note, i) => (
                <div key={i} className="mb-4">
                  <h4 className="text-sm font-bold text-foreground mb-1">{note.title}</h4>
                  <p className="text-sm text-muted-foreground">{note.content}</p>
                </div>
              ))}
            </div>
          )}

          {!data.docs?.anatomy && !data.docs?.keyboard && !data.docs?.notes && (
            <p className="text-sm text-muted-foreground">No accessibility information available.</p>
          )}
        </TabsContent>
      </Tabs>

      <div id="component-source" className="scroll-mt-24">
        <SourceViewer
          files={sourceFiles}
          mergedSource={data.mergedSource}
        />
      </div>

      <Pager className="mt-auto">
        {prev && (
          <PagerPrevious>
            <Link to="/$lib/docs/$" params={{ lib: library, _splat: `components/${prev}` }}>
              {prev}
            </Link>
          </PagerPrevious>
        )}
        {next && (
          <PagerNext>
            <Link to="/$lib/docs/$" params={{ lib: library, _splat: `components/${next}` }}>
              {next}
            </Link>
          </PagerNext>
        )}
      </Pager>
    </div>
  )
}

function resolveExamples(data: ComponentData): ExampleRef[] {
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
