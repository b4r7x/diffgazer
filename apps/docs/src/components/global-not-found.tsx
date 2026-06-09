import { Button } from "@diffgazer/ui/components/button";
import { Link } from "@tanstack/react-router";
import { DocsAppChrome } from "@/components/layout/docs-app-chrome";
import { NotFoundState } from "@/components/not-found-state";
import { PRIMARY_DOCS_LIBRARY_ID } from "@/lib/library";

export function GlobalNotFound() {
  return (
    <DocsAppChrome>
      <main
        id="main-content"
        tabIndex={-1}
        className="flex min-h-0 min-w-0 flex-1 flex-col outline-none"
      >
        <NotFoundState
          title="Page not found"
          description="The requested route does not exist."
          primaryAction={
            <Link to="/$lib" params={{ lib: PRIMARY_DOCS_LIBRARY_ID }}>
              <Button variant="primary" bracket>
                Open docs
              </Button>
            </Link>
          }
          secondaryAction={
            <Link
              to="/"
              className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            >
              [ GO_HOME ]
            </Link>
          }
        />
      </main>
    </DocsAppChrome>
  );
}
