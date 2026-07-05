import { useKey } from "@diffgazer/keys";
import { Kbd } from "@diffgazer/ui/components/kbd";
import { cn } from "@diffgazer/ui/lib/utils";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Fragment } from "react";
import { CHROME_LABEL_CLASS } from "@/components/shared/chrome-label";
import { FOCUS_RING_CLASS } from "@/components/shared/focus-ring";
import { isDocsPath } from "@/lib/library";

function KeyHint({ keys, label }: { keys: readonly string[]; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex items-center gap-1">
        {keys.map((key, index) => (
          <Fragment key={key}>
            {index > 0 && <span aria-hidden="true">/</span>}
            <Kbd size="sm">{key}</Kbd>
          </Fragment>
        ))}
      </span>
      <span>{label}</span>
    </span>
  );
}

export function FooterBar() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const onDocsPage = isDocsPath(pathname);

  useKey("f2", () => {
    void navigate({ to: "/$lib/$", params: { lib: "ui", _splat: "theme" } });
  });

  return (
    <footer
      className={cn(
        "flex shrink-0 items-center justify-between border-t border-border bg-background px-4 py-1",
        CHROME_LABEL_CLASS,
      )}
    >
      <div className="hidden items-center gap-6 sm:flex">
        {onDocsPage ? (
          <>
            <KeyHint keys={["/"]} label="search" />
            <KeyHint keys={["p", "n"]} label="prev/next" />
          </>
        ) : (
          <>
            <KeyHint keys={["j", "k"]} label="move" />
            <KeyHint keys={["↵"]} label="open" />
            <KeyHint keys={["/"]} label="search" />
          </>
        )}
        <Link
          to="/$lib/$"
          params={{ lib: "ui", _splat: "theme" }}
          className={`inline-flex items-center gap-1.5 transition-colors hover:text-foreground ${FOCUS_RING_CLASS}`}
        >
          <Kbd size="sm">F2</Kbd>
          <span>Theme</span>
        </Link>
      </div>
      <div className="flex items-center gap-6">
        <Link
          to="/privacy"
          className={`hidden transition-colors hover:text-foreground ${FOCUS_RING_CLASS} sm:inline`}
        >
          Privacy
        </Link>
        <Link
          to="/terms"
          className={`hidden transition-colors hover:text-foreground ${FOCUS_RING_CLASS} sm:inline`}
        >
          Terms
        </Link>
        <span>© 2026 diffgazer</span>
      </div>
    </footer>
  );
}
