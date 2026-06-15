import { useKey } from "@diffgazer/keys";
import { Kbd } from "@diffgazer/ui/components/kbd";
import { cn } from "@diffgazer/ui/lib/utils";
import { Link, useNavigate } from "@tanstack/react-router";
import { CHROME_LABEL_CLASS } from "@/components/shared/chrome-label";

export function FooterBar() {
  const navigate = useNavigate();

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
      <div className="flex items-center gap-6">
        <Link
          to="/$lib/$"
          params={{ lib: "ui", _splat: "theme" }}
          className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Kbd size="sm">F2</Kbd>
          <span>Theme</span>
        </Link>
      </div>
      <div className="flex items-center gap-6">
        <Link
          to="/privacy"
          className="transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Privacy
        </Link>
        <Link
          to="/terms"
          className="transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          Terms
        </Link>
        <span>© 2026 diffgazer</span>
      </div>
    </footer>
  );
}
