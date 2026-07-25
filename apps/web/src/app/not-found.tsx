import { Button } from "@diffgazer/ui/components/button";
import { Typography } from "@diffgazer/ui/components/typography";
import { Link } from "@tanstack/react-router";
import { useEffect } from "react";

export function NotFoundPage() {
  useEffect(() => {
    const previousTitle = document.title;
    const notFoundTitle = "Page not found — Diffgazer";
    document.title = notFoundTitle;

    return () => {
      if (document.title === notFoundTitle) document.title = previousTitle;
    };
  }, []);

  return (
    <div className="flex flex-1 items-center justify-center bg-background text-foreground font-mono">
      <div className="text-center">
        <Typography as="h1" size="2xl" className="text-error-text mb-2">
          Page not found
        </Typography>
        <p className="text-muted-foreground text-sm mb-4">
          The page you were looking for does not exist.
        </p>
        <Button variant="secondary">
          {({ className }) => (
            <Link to="/" className={className}>
              Go home
            </Link>
          )}
        </Button>
      </div>
    </div>
  );
}
