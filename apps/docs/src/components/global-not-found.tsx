import { TuiBracketLink } from "@/components/layout/tui-bracket-link";
import { NotFoundState } from "@/components/not-found-state";
import { PRIMARY_DOCS_LIBRARY_ID } from "@/lib/library";

export function GlobalNotFound() {
  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="flex min-h-0 min-w-0 flex-1 flex-col outline-hidden"
    >
      <NotFoundState
        title="Page not found"
        description="The requested route does not exist."
        actionLabel="GO_HOME"
        primaryAction={
          <TuiBracketLink variant="primary" to="/$lib" params={{ lib: PRIMARY_DOCS_LIBRARY_ID }}>
            Open docs
          </TuiBracketLink>
        }
        secondaryAction={<TuiBracketLink to="/">GO_HOME</TuiBracketLink>}
      />
    </main>
  );
}
