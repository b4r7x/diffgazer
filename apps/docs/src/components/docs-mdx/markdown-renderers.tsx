import { Callout } from "@diffgazer/ui/components/callout";
import {
  CodeBlock,
  CodeBlockContent,
  CodeBlockHeader,
  CodeBlockLabel,
  InlineCode,
} from "@diffgazer/ui/components/code-block";
import { ScrollArea } from "@diffgazer/ui/components/scroll-area";
import { Typography } from "@diffgazer/ui/components/typography";
import { cn } from "@diffgazer/ui/lib/utils";
import type { MDXComponents } from "mdx/types";
import {
  createContext,
  isValidElement,
  type ReactElement,
  type ReactNode,
  useContext,
} from "react";
import { SectionHeading } from "./section-heading";

type CalloutTone = "warning" | "error" | "success" | "info";
const PreCodeContext = createContext(false);

function extractTextContent(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(extractTextContent).join("");
  if (isValidElement(children)) {
    return extractTextContent((children as ReactElement<{ children?: ReactNode }>).props.children);
  }
  return "";
}

function detectCalloutTone(children: ReactNode): CalloutTone {
  const text = extractTextContent(children).trimStart();
  if (text.startsWith("Warning:") || text.startsWith("**Warning**")) {
    return "warning";
  }
  if (text.startsWith("Error:") || text.startsWith("**Error**")) {
    return "error";
  }
  if (text.startsWith("Tip:") || text.startsWith("**Tip**")) {
    return "success";
  }
  return "info";
}

function getLanguageLabel(children: ReactNode): string | undefined {
  if (!isValidElement(children)) return undefined;
  const props = (children as ReactElement<{ className?: string }>).props;
  const className = props.className ?? "";
  const match = className.match(/language-([a-z0-9-]+)/i);
  return match?.[1];
}

function CodeRenderer({ children, className }: { children: ReactNode; className?: string }) {
  const isInsidePre = useContext(PreCodeContext);
  if (isInsidePre || className) return <code className={className}>{children}</code>;
  return <InlineCode>{children}</InlineCode>;
}

export const markdownMdxComponents: MDXComponents = {
  h1: () => null,
  h2: (props) => <SectionHeading {...props} />,
  h3: ({ children, className, id, ...props }) => (
    <Typography
      as="h3"
      size="lg"
      id={id}
      className={cn("font-bold text-foreground mt-6 mb-2 scroll-mt-16 first:mt-0", className)}
      {...props}
    >
      {children}
    </Typography>
  ),
  p: ({ children }) => (
    <Typography as="p" size="sm" className="mt-4 mb-4 max-w-3xl first:mt-0">
      {children}
    </Typography>
  ),
  blockquote: ({ children }) => {
    const tone = detectCalloutTone(children);
    return (
      <Callout tone={tone} className="mt-4 mb-4 first:mt-0 [&_p]:max-w-none [&_p:last-child]:mb-0">
        <Callout.Content>{children}</Callout.Content>
      </Callout>
    );
  },
  code: CodeRenderer,
  pre: ({ children, ...rest }) => {
    // data-language is set by the "preserve-language" Shiki transformer in source.config.ts
    const dataLang = (rest as Record<string, unknown>)["data-language"];
    const language = typeof dataLang === "string" ? dataLang : getLanguageLabel(children);
    const isShell =
      language === "bash" || language === "sh" || language === "shell" || language === "zsh";
    return (
      <CodeBlock className="mt-4 mb-4 first:mt-0" variant={isShell ? "terminal" : undefined}>
        {language && (
          <CodeBlockHeader>
            <CodeBlockLabel>{language}</CodeBlockLabel>
          </CodeBlockHeader>
        )}
        <CodeBlockContent className="shiki" showLineNumbers={!isShell}>
          <PreCodeContext value={true}>{children}</PreCodeContext>
        </CodeBlockContent>
      </CodeBlock>
    );
  },
  table: ({ children }) => (
    <ScrollArea
      orientation="horizontal"
      aria-label="Scrollable table"
      className="mt-4 mb-4 rounded-sm first:mt-0"
    >
      <table className="w-full text-sm border-collapse border border-border">{children}</table>
    </ScrollArea>
  ),
  thead: ({ children }) => <thead className="bg-border/10">{children}</thead>,
  th: ({ children }) => (
    <th className="text-left px-6 py-3 text-2xs font-bold uppercase tracking-widest text-muted-foreground border-b border-border">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-6 py-4 text-sm text-muted-foreground border border-border">{children}</td>
  ),
  a: ({ children, href }) => {
    const isExternal = href?.startsWith("http");

    return (
      <a
        href={href}
        className="text-foreground hover:underline"
        {...(isExternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {children}
      </a>
    );
  },
  ul: ({ children }) => (
    // biome-ignore lint/a11y/useSemanticElements: this already is a <ul>; the explicit role="list" below restores list semantics that list-style:none strips, and Biome should not suggest swapping the element.
    <ul
      // biome-ignore lint/a11y/noRedundantRoles: list-style:none drops list semantics in Safari/VoiceOver; role="list" restores them.
      role="list"
      className="docs-md-list-bullet list-none space-y-1 mt-4 mb-4 ml-4 text-sm text-foreground/90 first:mt-0"
    >
      {children}
    </ul>
  ),
  ol: ({ children }) => (
    // biome-ignore lint/a11y/useSemanticElements: this already is an <ol>; the explicit role="list" below restores list semantics that list-style:none strips, and Biome should not suggest swapping the element.
    <ol
      // biome-ignore lint/a11y/noRedundantRoles: list-style:none drops list semantics in Safari/VoiceOver; role="list" restores them.
      role="list"
      className="docs-md-list-ordered list-none space-y-1 mt-4 mb-4 ml-4 text-sm text-foreground/90 first:mt-0 [counter-reset:list-counter]"
    >
      {children}
    </ol>
  ),
  li: ({ children }) => (
    <li className="relative pl-4 before:absolute before:left-0 before:text-muted-foreground">
      {children}
    </li>
  ),
  hr: () => <hr className="border-border border-dashed opacity-50 my-8" />,
  strong: ({ children }) => <strong className="font-bold text-foreground">{children}</strong>,
  em: ({ children }) => <em className="italic text-foreground/80">{children}</em>,
};
