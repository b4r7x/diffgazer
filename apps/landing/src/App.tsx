export function App() {
  return (
    <div className="min-h-screen bg-background font-mono text-foreground">
      <main className="mx-auto max-w-2xl px-4 py-16">
        <h1 className="text-2xl font-bold text-tui-text">diffgazer</h1>
        <p className="mt-4 text-tui-dim">
          AI code review for your terminal. Local-first. Privacy-respecting.
        </p>
        <div className="mt-8 flex gap-4">
          <code className="rounded border border-tui-border bg-tui-surface-1 px-3 py-2 text-sm text-tui-blue">
            npm install -g diffgazer
          </code>
        </div>
        <div className="mt-8">
          <a
            href="https://docs.b4r7.dev"
            className="text-tui-blue underline hover:text-tui-text"
          >
            Documentation →
          </a>
        </div>
      </main>
    </div>
  );
}
