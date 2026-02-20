import type { MDXComponents } from "mdx/types"
import { createContext, isValidElement, useContext, type ReactElement, type ReactNode } from "react"
import { Callout } from "@/components/ui/callout"
import { CodeBlock } from "@/components/ui/code-block/code-block"
import { SectionHeader } from "@/components/ui/section-header/section-header"
import { cn } from "@/lib/utils"

type CalloutVariant = "warning" | "error" | "success" | "info"
const PreCodeContext = createContext(false)

function extractTextContent(children: ReactNode): string {
  if (typeof children === "string") return children
  if (typeof children === "number") return String(children)
  if (Array.isArray(children)) return children.map(extractTextContent).join("")
  if (isValidElement(children)) {
    return extractTextContent((children as ReactElement<{ children?: ReactNode }>).props.children)
  }
  return ""
}

function detectCalloutVariant(children: ReactNode): CalloutVariant {
  const text = extractTextContent(children).trimStart()
  if (text.startsWith("Warning:") || text.startsWith("**Warning**")) {
    return "warning"
  }
  if (text.startsWith("Error:") || text.startsWith("**Error**")) {
    return "error"
  }
  if (text.startsWith("Tip:") || text.startsWith("**Tip**")) {
    return "success"
  }
  return "info"
}

function getLanguageLabel(children: ReactNode): string | undefined {
  if (!isValidElement(children)) return undefined
  const props = (children as ReactElement<{ className?: string }>).props
  const className = props.className ?? ""
  const match = className.match(/language-([a-z0-9-]+)/i)
  return match?.[1]
}

export const markdownMdxComponents: MDXComponents = {
  h1: () => null,
  h2: ({ children, className, id, ...props }) => (
    <SectionHeader
      as="h2"
      id={id}
      className={cn("mt-8 mb-4 scroll-mt-24", className)}
      {...props}
    >
      {children}
    </SectionHeader>
  ),
  h3: ({ children, className, id, ...props }) => (
    <h3
      id={id}
      className={cn("text-xl font-bold text-foreground mt-6 mb-3 scroll-mt-24", className)}
      {...props}
    >
      {children}
    </h3>
  ),
  p: ({ children }) => (
    <p className="text-sm leading-relaxed text-muted-foreground mb-4 max-w-2xl">
      {children}
    </p>
  ),
  blockquote: ({ children }) => {
    const variant = detectCalloutVariant(children)
    return (
      <Callout variant={variant} className="mb-4">
        {children}
      </Callout>
    )
  },
  code: ({ children, className }) => {
    const isInsidePre = useContext(PreCodeContext)
    if (isInsidePre) return <code className={className}>{children}</code>
    if (className) return <code className={className}>{children}</code>
    return (
      <code className="bg-secondary text-foreground px-1.5 py-0.5 text-xs font-mono rounded-sm">
        {children}
      </code>
    )
  },
  pre: ({ children, className }) => (
    <CodeBlock label={getLanguageLabel(children)} className="mb-4" preClassName={className}>
      <PreCodeContext.Provider value>
        {children}
      </PreCodeContext.Provider>
    </CodeBlock>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-4 overflow-hidden rounded-sm">
      <table className="w-full text-sm border-collapse border border-border">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-border/10">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="text-left px-6 py-3 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-6 py-4 text-sm text-muted-foreground border border-border">
      {children}
    </td>
  ),
  a: ({ children, href }) => {
    const isExternal = href?.startsWith("http")
    return (
      <a
        href={href}
        className="text-foreground hover:underline"
        {...(isExternal
          ? { target: "_blank", rel: "noopener noreferrer" }
          : {})}
      >
        {children}
      </a>
    )
  },
  ul: ({ children }) => (
    <ul className="list-none space-y-1 mb-4 ml-4 text-sm text-foreground/90 [&>li]:before:content-['-']">
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    <ol className="list-none space-y-1 mb-4 ml-4 text-sm text-foreground/90 [counter-reset:list-counter] [&>li]:before:content-[counter(list-counter,decimal)_'._'] [&>li]:[counter-increment:list-counter]">
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="relative pl-4 before:absolute before:left-0 before:text-muted-foreground">
      {children}
    </li>
  ),
  hr: () => <hr className="border-border border-dashed opacity-50 my-8" />,
  strong: ({ children }) => (
    <strong className="font-bold text-foreground">{children}</strong>
  ),
  em: ({ children }) => (
    <em className="italic text-foreground/80">{children}</em>
  ),
}
