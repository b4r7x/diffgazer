import { buttonVariants } from "@/components/ui/button/button"

const REVIEW_LENSES = [
  "Correctness",
  "Security",
  "Performance",
  "Simplicity",
  "Tests",
]

const QUICK_START = [
  "npm install -g diffgazer",
  "cd your-project",
  "diffgazer",
]

export function DiffgazerPreview() {
  return (
    <section className="border border-border p-6 space-y-4 bg-[radial-gradient(#333_1px,transparent_1px)] [background-size:20px_20px]">
      <header className="flex items-center justify-between gap-3">
        <p className="text-xs font-mono text-muted-foreground">
          Local AI code review
        </p>
        <span className="text-[10px] uppercase tracking-wider border border-border px-1.5 py-0.5 bg-background font-mono text-muted-foreground">
          Diffgazer
        </span>
      </header>

      <p className="text-sm text-muted-foreground max-w-2xl">
        Run one command and get a structured review from dedicated AI agents.
        Your workflow stays local and you pick the provider.
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        {REVIEW_LENSES.map((lens) => (
          <p key={lens} className="text-xs font-mono border border-border px-2 py-1 bg-background">
            {lens}
          </p>
        ))}
      </div>

      <div className="border border-border bg-background p-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
          Quick start
        </p>
        <pre className="text-xs font-mono text-foreground whitespace-pre-wrap">{QUICK_START.join("\n")}</pre>
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
  )
}
