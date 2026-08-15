import {
  CodeBlock,
  CodeBlockContent,
  CodeBlockHeader,
  CodeBlockLabel,
} from "@diffgazer/ui/components/code-block";
import { CopyButton } from "@/components/copy-button";
import type { DocsTheme } from "@/hooks/theme-context";

interface CssOutputProps {
  theme: DocsTheme;
  primitives: Record<string, string>;
  defaults: Record<string, string>;
}

function themePrimitiveSelector(theme: DocsTheme): string {
  return theme === "light" ? '[data-theme="light"]' : ':root,\n[data-theme="dark"]';
}

export function CssOutput({ theme, primitives, defaults }: CssOutputProps) {
  const changed = Object.entries(primitives).filter(([key, val]) => val !== defaults[key]);

  if (changed.length === 0) {
    return (
      <p className="text-xs text-muted-foreground font-mono">
        No changes yet. Edit a color above to generate CSS.
      </p>
    );
  }

  const selector = themePrimitiveSelector(theme);
  const css = `${selector} {\n${changed.map(([k, v]) => `  ${k}: ${v};`).join("\n")}\n}`;

  return (
    <CodeBlock>
      <CodeBlockHeader>
        <CodeBlockLabel>css</CodeBlockLabel>
        <CopyButton text={css} />
      </CodeBlockHeader>
      <CodeBlockContent>{css}</CodeBlockContent>
    </CodeBlock>
  );
}
