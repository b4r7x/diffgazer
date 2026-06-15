import { buttonVariants } from "@diffgazer/ui/components/button";
import { CodeBlock } from "@diffgazer/ui/components/code-block";
import { DOT_GRID_CLASS } from "../dot-grid";

const REVIEW_LENSES = ["Correctness", "Security", "Performance", "Simplicity", "Tests"];

const QUICK_START = ["npm install -g diffgazer", "cd your-project", "diffgazer"];

export function DiffgazerPreview() {
  return (
    <section className={`border border-border p-6 space-y-4 ${DOT_GRID_CLASS}`}>
      <header className="flex items-center justify-between gap-3">
        <p className="text-xs font-mono text-muted-foreground">Local AI code review</p>
        <span className="text-2xs uppercase tracking-widest border border-border px-1.5 py-0.5 bg-background font-mono text-muted-foreground">
          Diffgazer
        </span>
      </header>

      <p className="text-sm text-muted-foreground max-w-2xl">
        Install the published CLI, then get a structured review from dedicated AI agents.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        {REVIEW_LENSES.map((lens) => (
          <p key={lens} className="text-xs font-mono border border-border px-2 py-1 bg-background">
            {lens}
          </p>
        ))}
      </div>

      <div className="border border-border bg-background p-3">
        <p className="text-2xs uppercase tracking-widest text-muted-foreground mb-2">Quick start</p>
        <CodeBlock variant="terminal">
          <CodeBlock.Content showLineNumbers={false}>{QUICK_START.join("\n")}</CodeBlock.Content>
        </CodeBlock>
      </div>

      <a
        href="https://github.com/b4r7x/diffgazer"
        target="_blank"
        rel="noreferrer"
        className={buttonVariants({ variant: "link", size: "sm" })}
      >
        View diffgazer on GitHub
      </a>
    </section>
  );
}
