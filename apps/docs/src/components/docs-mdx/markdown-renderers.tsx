import type { MDXComponents } from "mdx/types"
import { createContext, isValidElement, useContext, type ReactElement, type ReactNode } from "react"
import { Callout } from "@/components/ui/callout"
import { CodeBlock, CodeBlockContent, CodeBlockHeader, CodeBlockLabel, InlineCode } from "@/components/ui/code-block"
import { Typography } from "@/components/ui/typography/typography"
import { cn } from "@diffgazer/ui/lib/utils"

type CalloutTone = "warning" | "error" | "success" | "info"
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

function detectCalloutTone(children: ReactNode): CalloutTone {
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

function CodeRenderer({ children, className }: { children: ReactNode; className?: string }) {
  const isInsidePre = useContext(PreCodeContext)
  if (isInsidePre || className) return <code className={className}>{children}</code>
  return <InlineCode>{children}</InlineCode>
}

export const markdownMdxComponents: MDXComponents = {
  h1: () => null,
  h2: ({ children, className, id, ...props }) => (
    <Typography
      as="h2"
      size="2xl"
      id={id}
      className={cn(
        "font-bold text-foreground mt-16 mb-6 pb-3 border-b border-border scroll-mt-24",
        className,
      )}
      {...props}
    >
      {children}
    </Typography>
  ),
  h3: ({ children, className, id, ...props }) => (
    <Typography
      as="h3"
      size="lg"
      id={id}
      className={cn("font-bold text-foreground mt-10 mb-4 scroll-mt-24", className)}
      {...props}
    >
      {children}
    </Typography>
  ),
  p: ({ children }) => (
    <p className="text-sm leading-relaxed text-muted-foreground mb-4 max-w-2xl">
      {children}
    </p>
  ),
  blockquote: ({ children }) => {
    const tone = detectCalloutTone(children)
    return (
      <Callout tone={tone} className="mb-4 [&_p]:max-w-none">
        <Callout.Content>{children}</Callout.Content>
      </Callout>
    )
  },
  code: CodeRenderer,
  pre: ({ children, ...rest }) => {
    // data-language is set by the "preserve-language" Shiki transformer in source.config.ts
    const dataLang = (rest as Record<string, unknown>)["data-language"]
    const language = typeof dataLang === "string" ? dataLang : getLanguageLabel(children)
    const isShell = language === "bash" || language === "sh" || language === "shell" || language === "zsh"
    return (
      <CodeBlock className="mb-4" variant={isShell ? "terminal" : undefined}>
        {language && (
          <CodeBlockHeader>
            <CodeBlockLabel>{language}</CodeBlockLabel>
          </CodeBlockHeader>
        )}
        <CodeBlockContent className="shiki" showLineNumbers={!isShell}>
          <PreCodeContext.Provider value={true}>
            {children}
          </PreCodeContext.Provider>
        </CodeBlockContent>
      </CodeBlock>
    )
  },
  table: ({ children }) => (
    <div className="overflow-x-auto overflow-y-hidden mb-4 rounded-sm">
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
