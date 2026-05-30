import { siteLinks } from "./siteLinks";

export function App() {
  return (
    <div className="min-h-screen bg-background font-mono text-foreground">
      <main className="mx-auto max-w-md px-4 py-16">
        <h1 className="text-2xl font-bold text-tui-fg">b4r7</h1>
        <p className="mt-4 text-tui-dim">Developer tools and open source projects.</p>
        <ul className="mt-8 space-y-3">
          <li>
            <a
              href={siteLinks.diffgazer}
              className="text-tui-blue underline hover:text-tui-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            >
              diffgazer
            </a>{" "}
            <span className="text-tui-dim">— AI code review CLI</span>
          </li>
          <li>
            <a
              href={siteLinks.docs}
              className="text-tui-blue underline hover:text-tui-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            >
              docs
            </a>{" "}
            <span className="text-tui-dim">— component library & keyboard hooks</span>
          </li>
          <li>
            <a
              href={siteLinks.github}
              className="text-tui-blue underline hover:text-tui-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground"
            >
              github
            </a>
          </li>
        </ul>
      </main>
    </div>
  );
}
