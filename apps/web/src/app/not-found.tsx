import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { FailureView } from "@/components/shared/failure-view";

export function NotFoundPage() {
  const navigate = useNavigate();

  // No route matches a not-found render, so head()/HeadContent never fires here;
  // the title is set by hand and restored on unmount unless another screen has
  // already changed it.
  useEffect(() => {
    const previousTitle = document.title;
    const notFoundTitle = "Page not found — Diffgazer";
    document.title = notFoundTitle;

    return () => {
      if (document.title === notFoundTitle) document.title = previousTitle;
    };
  }, []);

  return (
    <FailureView
      title="Page Not Found"
      message="The page you were looking for does not exist."
      scope="not-found"
      titleAs="h1"
      primary={{ label: "Go to Home", onAction: () => void navigate({ to: "/" }) }}
      secondary={{ label: "Reload", onAction: () => window.location.reload() }}
      // Esc runs the secondary action, so the label must name it.
      footerRightShortcuts={[{ key: "Esc", label: "Reload" }]}
    />
  );
}
