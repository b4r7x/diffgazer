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
      // One way out of a route that does not exist: reloading it only fetches the
      // same missing page again, so Home is both the action and the Esc target.
      primary={{ label: "Go to Home", onAction: () => void navigate({ to: "/" }) }}
      footerRightShortcuts={[{ key: "Esc", label: "Home" }]}
    />
  );
}
